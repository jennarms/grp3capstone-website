from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import mysql
from datetime import datetime, timedelta
import uuid

schedules_bp = Blueprint('schedules_bp', __name__)


# ---- Helper function: Generate unique IDs ----
def generate_id(prefix):
    return f"{prefix}{uuid.uuid4().hex[:6].upper()}"


# ---- Helper function: Compute ETA based on previous departure ----
def compute_eta(prev_departure, next_departure):
    """
    ETA = next_departure if provided, else NULL
    Formula: ETA_next = departure_next - departure_prev (time difference)
    """
    if not next_departure or not prev_departure:
        return None

    fmt = "%H:%M:%S"
    prev_time = datetime.strptime(prev_departure, fmt)
    next_time = datetime.strptime(next_departure, fmt)
    delta = next_time - prev_time
    eta_time = prev_time + delta
    return eta_time.strftime(fmt)


# ---- Fetch all routes for dropdown ----
@schedules_bp.route('/routes', methods=['GET'])
@jwt_required()
def fetch_routes():
    cursor = mysql.connection.cursor()
    try:
        cursor.execute("SELECT Route_ID, Route_name, Water_flow FROM Route WHERE is_active=1")
        routes = cursor.fetchall()
        result = [{
            "Route_ID": row[0],
            "Route_name": row[1],
            "Water_flow": row[2]
        } for row in routes]
        return jsonify(result)
    finally:
        cursor.close()


# ---- Fetch all stations per route ----
@schedules_bp.route('/stations', methods=['GET'])
@jwt_required()
def fetch_route_stations():
    route_id = request.args.get('Route_ID')
    if not route_id:
        return jsonify({"error": "Route_ID is required"}), 400

    cursor = mysql.connection.cursor()
    try:
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


# ---- Create a full ride ----
@schedules_bp.route('/create', methods=['POST'])
@jwt_required()
def create_ride():
    data = request.json
    route_id = data.get('Route_ID')
    departure_times = data.get('departureTimes')  # list of dicts: [{"RouteStation_ID":..., "departureTime":...}, ...]

    if not route_id or not departure_times:
        return jsonify({"error": "Route_ID and departureTimes are required"}), 400

    ride_id = generate_id("RIDE")
    cursor = mysql.connection.cursor()
    try:
        prev_departure = None
        for dt in sorted(departure_times, key=lambda x: x.get('StopOrder', 0)):
            schedule_id = generate_id("S")
            route_station_id = dt.get("RouteStation_ID")
            departure_time = dt.get("departureTime")  # can be NULL
            eta = compute_eta(prev_departure, departure_time) if prev_departure else departure_time

            cursor.execute("""
                INSERT INTO Schedule (Schedule_ID, Ride_ID, Route_ID, RouteStation_ID, departureTime, ETA)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (schedule_id, ride_id, route_id, route_station_id, departure_time, eta))

            if departure_time:
                prev_departure = departure_time  # only consider non-null departures for ETA chain

        mysql.connection.commit()
        return jsonify({"message": "Ride created successfully", "Ride_ID": ride_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()


# ---- Update a full ride ----
@schedules_bp.route('/update/<ride_id>', methods=['PUT'])
@jwt_required()
def update_ride(ride_id):
    data = request.json
    departure_times = data.get('departureTimes')  # list of dicts: [{"RouteStation_ID":..., "departureTime":...}, ...]

    if not departure_times:
        return jsonify({"error": "departureTimes are required"}), 400

    cursor = mysql.connection.cursor()
    try:
        prev_departure = None
        for dt in sorted(departure_times, key=lambda x: x.get('StopOrder', 0)):
            route_station_id = dt.get("RouteStation_ID")
            departure_time = dt.get("departureTime")
            eta = compute_eta(prev_departure, departure_time) if prev_departure else departure_time

            cursor.execute("""
                UPDATE Schedule
                SET departureTime=%s, ETA=%s
                WHERE Ride_ID=%s AND RouteStation_ID=%s
            """, (departure_time, eta, ride_id, route_station_id))

            if departure_time:
                prev_departure = departure_time

        mysql.connection.commit()
        return jsonify({"message": "Ride updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()


# ---- Delete a full ride ----
@schedules_bp.route('/delete/<ride_id>', methods=['DELETE'])
@jwt_required()
def delete_ride(ride_id):
    cursor = mysql.connection.cursor()
    try:
        cursor.execute("DELETE FROM Schedule WHERE Ride_ID=%s", (ride_id,))
        mysql.connection.commit()
        return jsonify({"message": "Ride deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()


# ---- Fetch all schedules per route grouped by ride ----
@schedules_bp.route('/by-route', methods=['GET'])
@jwt_required()
def get_schedules_by_route():
    route_id = request.args.get('Route_ID')
    if not route_id:
        return jsonify({"error": "Route_ID is required"}), 400

    cursor = mysql.connection.cursor()
    try:
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
