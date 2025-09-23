from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import mysql
from datetime import datetime, timedelta
import uuid

schedules_bp = Blueprint('schedules_bp', __name__)


# ---- Helper function: Generate incremental IDs ----
def generate_schedule_id():
    """Generate incremental Schedule_ID like SC0001, SC0002, etc."""
    cursor = mysql.connection.cursor()
    try:
        # Get the highest existing Schedule_ID
        cursor.execute("SELECT Schedule_ID FROM Schedule WHERE Schedule_ID LIKE 'SC%' ORDER BY Schedule_ID DESC LIMIT 1")
        result = cursor.fetchone()
        
        if result:
            # Extract number from SC0001 format
            last_id = result[0]
            number = int(last_id[2:])  # Remove 'SC' prefix
            new_number = number + 1
        else:
            new_number = 1
        
        # Format with leading zeros (4 digits)
        return f"SC{new_number:04d}"
    except Exception as e:
        print(f"Error generating Schedule ID: {e}")
        # Fallback to timestamp-based ID
        return f"SC{int(datetime.now().timestamp())}"
    finally:
        cursor.close()


def generate_ride_id():
    """Generate incremental Ride_ID like RIDE0001, RIDE0002, etc."""
    cursor = mysql.connection.cursor()
    try:
        # Get the highest existing Ride_ID
        cursor.execute("SELECT Ride_ID FROM Schedule WHERE Ride_ID LIKE 'RIDE%' GROUP BY Ride_ID ORDER BY Ride_ID DESC LIMIT 1")
        result = cursor.fetchone()
        
        if result:
            # Extract number from RIDE0001 format
            last_id = result[0]
            number = int(last_id[4:])  # Remove 'RIDE' prefix
            new_number = number + 1
        else:
            new_number = 1
        
        # Format with leading zeros (4 digits)
        return f"RIDE{new_number:04d}"
    except Exception as e:
        print(f"Error generating Ride ID: {e}")
        # Fallback to timestamp-based ID
        return f"RIDE{int(datetime.now().timestamp())}"
    finally:
        cursor.close()


# ---- Helper function: Get company_id for logged in admin ----
def get_company_id_for_admin(admin_id):
    cursor = mysql.connection.cursor()
    try:
        cursor.execute("SELECT Company_ID FROM MainAdmin WHERE Admin_ID=%s", (admin_id,))
        row = cursor.fetchone()
        return row[0] if row else None
    finally:
        cursor.close()


# ---- Helper function: Simple ETA calculation ----
def calculate_simple_eta(departure_times_list):
    """
    ETA calculation (segment-based):
    - First station ETA = 0 (reference).
    - Each next station ETA = difference in minutes from the *previous station's* departureTime.
    - If no departureTime, ETA = None.
    - Returns ETA as integer minutes (works best if ETA column = INT).
    """
    print(f"DEBUG: Input departure_times_list: {departure_times_list}")

    # Sort by StopOrder just to be sure
    sorted_departures = sorted(departure_times_list, key=lambda x: x.get('StopOrder', 0))

    results = []
    prev_datetime = None

    for idx, station_data in enumerate(sorted_departures):
        route_station_id = station_data.get("RouteStation_ID")
        departure_time = station_data.get("departureTime")
        stop_order = station_data.get("StopOrder", 0)

        eta = None

        if departure_time and departure_time.strip() != "":
            try:
                # Parse departure time
                try:
                    current_datetime = datetime.strptime(departure_time, "%H:%M:%S")
                except ValueError:
                    current_datetime = datetime.strptime(departure_time, "%H:%M")

                if prev_datetime:
                    # ETA = current station time − previous station time
                    time_diff = current_datetime - prev_datetime
                    minutes_diff = int(time_diff.total_seconds() / 60)
                    if minutes_diff < 0:
                        minutes_diff += 24 * 60  # Handle day wrap
                    eta = minutes_diff
                else:
                    # First station = 0 minutes
                    eta = 0

                prev_datetime = current_datetime
                print(f"DEBUG: {route_station_id}: ETA {eta} minutes (from {departure_time})")

            except ValueError as e:
                print(f"DEBUG: Error parsing departure time {departure_time}: {e}")
                eta = None
        else:
            print(f"DEBUG: {route_station_id}: No departure time → ETA stays None")

        results.append({
            "RouteStation_ID": route_station_id,
            "departureTime": departure_time,
            "ETA": eta,
            "StopOrder": stop_order
        })

    return results


# ---- Fetch all routes for dropdown (no active filter) ----
@schedules_bp.route('/routes', methods=['GET'])
@jwt_required()
def fetch_routes():
    from flask_jwt_extended import get_jwt_identity
    
    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        
        if not company_id:
            return jsonify([]), 200

        cursor = mysql.connection.cursor()
        try:
            # Fetch all routes for the company (no active filter)
            cursor.execute("""
                SELECT Route_ID, Route_name, Water_flow 
                FROM Route 
                WHERE Company_ID=%s
                ORDER BY Route_name
            """, (company_id,))
            routes = cursor.fetchall()
            
            result = [{
                "Route_ID": row[0],
                "Route_name": row[1],
                "Water_flow": row[2] if row[2] else "N/A"
            } for row in routes]
            return jsonify(result)
        finally:
            cursor.close()
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---- Fetch all stations per route ----
@schedules_bp.route('/stations', methods=['GET'])
@jwt_required()
def fetch_route_stations():
    from flask_jwt_extended import get_jwt_identity
    
    route_id = request.args.get('Route_ID')
    if not route_id:
        return jsonify({"error": "Route_ID is required"}), 400

    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        
        if not company_id:
            return jsonify([]), 200

        cursor = mysql.connection.cursor()
        try:
            # Verify route belongs to admin's company
            cursor.execute("SELECT Route_ID FROM Route WHERE Route_ID=%s AND Company_ID=%s", (route_id, company_id))
            if not cursor.fetchone():
                return jsonify({"error": "Route not found or access denied"}), 404

            # Fetch stations for the route
            cursor.execute("""
                SELECT RouteStation_ID, Station_ID, StationName, StopOrder
                FROM RouteStations
                WHERE Route_ID=%s
                ORDER BY StopOrder ASC
            """, (route_id,))
            stations = cursor.fetchall()
            
            result = [{
                "RouteStation_ID": row[0],
                "Station_ID": row[1],
                "StationName": row[2],
                "StopOrder": row[3]
            } for row in stations]
            return jsonify(result)
        finally:
            cursor.close()
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---- Create a full ride ----
@schedules_bp.route('/create', methods=['POST'])
@jwt_required()
def create_ride():
    from flask_jwt_extended import get_jwt_identity
    
    data = request.json
    route_id = data.get('Route_ID')
    departure_times = data.get('departureTimes')

    if not route_id or not departure_times:
        return jsonify({"error": "Route_ID and departureTimes are required"}), 400

    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        
        if not company_id:
            return jsonify({"error": "Company not found"}), 400

        cursor = mysql.connection.cursor()
        try:
            # Verify route belongs to admin's company
            cursor.execute("SELECT Route_ID FROM Route WHERE Route_ID=%s AND Company_ID=%s", (route_id, company_id))
            if not cursor.fetchone():
                return jsonify({"error": "Route not found or access denied"}), 404

            ride_id = generate_ride_id()
            
            # Calculate ETAs for all stations
            calculated_stations = calculate_simple_eta(departure_times)
            
            # Insert all schedule entries
            for station_data in calculated_stations:
                schedule_id = generate_schedule_id()
                route_station_id = station_data["RouteStation_ID"]
                departure_time = station_data["departureTime"]
                eta = station_data["ETA"]

                cursor.execute("""
                    INSERT INTO Schedule (Schedule_ID, Ride_ID, Route_ID, RouteStation_ID, departureTime, ETA)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (schedule_id, ride_id, route_id, route_station_id, departure_time, eta))

            mysql.connection.commit()
            return jsonify({"message": "Ride created successfully", "Ride_ID": ride_id}), 201
        except Exception as e:
            mysql.connection.rollback()
            raise e
        finally:
            cursor.close()
    except Exception as e:
        print(f"Error creating ride: {e}")
        return jsonify({"error": str(e)}), 500


# ---- Update a full ride ----
@schedules_bp.route('/update/<ride_id>', methods=['PUT'])
@jwt_required()
def update_ride(ride_id):
    from flask_jwt_extended import get_jwt_identity
    
    data = request.json
    departure_times = data.get('departureTimes')

    if not departure_times:
        return jsonify({"error": "departureTimes are required"}), 400

    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        
        if not company_id:
            return jsonify({"error": "Company not found"}), 400

        cursor = mysql.connection.cursor()
        try:
            # Get route_id for this ride and verify it belongs to admin's company
            cursor.execute("""
                SELECT DISTINCT r.Route_ID 
                FROM Schedule s
                JOIN Route r ON s.Route_ID = r.Route_ID
                WHERE s.Ride_ID=%s AND r.Company_ID=%s
            """, (ride_id, company_id))
            route_result = cursor.fetchone()
            
            if not route_result:
                return jsonify({"error": "Ride not found or access denied"}), 404
            
            route_id = route_result[0]
            
            # Calculate ETAs for all stations
            calculated_stations = calculate_simple_eta(departure_times)
            
            # Update all schedule entries
            for station_data in calculated_stations:
                route_station_id = station_data["RouteStation_ID"]
                departure_time = station_data["departureTime"]
                eta = station_data["ETA"]

                cursor.execute("""
                    UPDATE Schedule
                    SET departureTime=%s, ETA=%s
                    WHERE Ride_ID=%s AND RouteStation_ID=%s
                """, (departure_time, eta, ride_id, route_station_id))

            mysql.connection.commit()
            return jsonify({"message": "Ride updated successfully"})
        except Exception as e:
            mysql.connection.rollback()
            raise e
        finally:
            cursor.close()
    except Exception as e:
        print(f"Error updating ride: {e}")
        return jsonify({"error": str(e)}), 500


# ---- Delete a full ride ----
@schedules_bp.route('/delete/<ride_id>', methods=['DELETE'])
@jwt_required()
def delete_ride(ride_id):
    from flask_jwt_extended import get_jwt_identity
    
    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        
        if not company_id:
            return jsonify({"error": "Company not found"}), 400

        cursor = mysql.connection.cursor()
        try:
            # Verify ride belongs to admin's company
            cursor.execute("""
                SELECT DISTINCT r.Route_ID 
                FROM Schedule s
                JOIN Route r ON s.Route_ID = r.Route_ID
                WHERE s.Ride_ID=%s AND r.Company_ID=%s
            """, (ride_id, company_id))
            
            if not cursor.fetchone():
                return jsonify({"error": "Ride not found or access denied"}), 404

            cursor.execute("DELETE FROM Schedule WHERE Ride_ID=%s", (ride_id,))
            mysql.connection.commit()
            return jsonify({"message": "Ride deleted successfully"})
        except Exception as e:
            mysql.connection.rollback()
            raise e
        finally:
            cursor.close()
    except Exception as e:
        print(f"Error deleting ride: {e}")
        return jsonify({"error": str(e)}), 500


# ---- Fetch all schedules per route grouped by ride ----
@schedules_bp.route('/by-route', methods=['GET'])
@jwt_required()
def get_schedules_by_route():
    from flask_jwt_extended import get_jwt_identity
    
    route_id = request.args.get('Route_ID')
    if not route_id:
        return jsonify({"error": "Route_ID is required"}), 400

    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        
        if not company_id:
            return jsonify([]), 200

        cursor = mysql.connection.cursor()
        try:
            # Verify route belongs to admin's company
            cursor.execute("SELECT Route_ID FROM Route WHERE Route_ID=%s AND Company_ID=%s", (route_id, company_id))
            if not cursor.fetchone():
                return jsonify({"error": "Route not found or access denied"}), 404

            # Fetch all stations for the route
            cursor.execute("""
                SELECT RouteStation_ID, Station_ID, StationName, StopOrder
                FROM RouteStations
                WHERE Route_ID=%s
                ORDER BY StopOrder ASC
            """, (route_id,))
            stations = cursor.fetchall()

            # Fetch all schedules for the route
            cursor.execute("""
                SELECT Schedule_ID, Ride_ID, RouteStation_ID, departureTime, ETA
                FROM Schedule
                WHERE Route_ID=%s
                ORDER BY Ride_ID, RouteStation_ID
            """, (route_id,))
            schedules = cursor.fetchall()

            # Organize schedules by Ride_ID and RouteStation_ID
            schedule_dict = {}
            for s in schedules:
                schedule_dict.setdefault(s[1], {})[s[2]] = {
                    "Schedule_ID": s[0],
                    "departureTime": str(s[3]) if s[3] else None,
                    "ETA": str(s[4]) if s[4] else None
                }

            # Build result
            result = []
            for ride_id, ride_schedules in schedule_dict.items():
                ride_info = {"Ride_ID": ride_id, "stations": []}
                for st in stations:
                    route_station_id, station_id, station_name, stop_order = st
                    schedule = ride_schedules.get(route_station_id, {})
                    ride_info["stations"].append({
                        "RouteStation_ID": route_station_id,
                        "Station_ID": station_id,
                        "StationName": station_name,
                        "StopOrder": stop_order,
                        "Schedule_ID": schedule.get("Schedule_ID"),
                        "departureTime": schedule.get("departureTime"),
                        "ETA": schedule.get("ETA")
                    })
                result.append(ride_info)

            return jsonify(result)
        finally:
            cursor.close()
    except Exception as e:
        print(f"Error fetching schedules: {e}")
        return jsonify({"error": str(e)}), 500


# ---- Test endpoint to check if backend is working ----
@schedules_bp.route('/test', methods=['GET'])
@jwt_required()
def test_endpoint():
    return jsonify({"message": "Schedules backend is working!", "timestamp": datetime.now().isoformat()})