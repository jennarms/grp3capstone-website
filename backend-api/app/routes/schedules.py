from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import mysql
from datetime import datetime

schedules_bp = Blueprint('schedules_bp', __name__)


# =========================
# Helpers
# =========================

def generate_schedule_id():
    """Generate incremental Schedule_ID like SC0001, SC0002, etc."""
    cursor = mysql.connection.cursor()
    try:
        cursor.execute("""
            SELECT Schedule_ID
            FROM Schedule
            WHERE Schedule_ID LIKE 'SC%'
            ORDER BY Schedule_ID DESC
            LIMIT 1
        """)
        result = cursor.fetchone()

        if result:
            last_id = result[0]
            number = int(last_id[2:])  # remove "SC"
            new_number = number + 1
        else:
            new_number = 1

        return f"SC{new_number:04d}"
    except Exception as e:
        print(f"Error generating Schedule ID: {e}")
        return f"SC{int(datetime.now().timestamp())}"
    finally:
        cursor.close()


def generate_ride_id():
    """Generate incremental Ride_ID like RIDE0001, RIDE0002, etc."""
    cursor = mysql.connection.cursor()
    try:
        cursor.execute("""
            SELECT Ride_ID
            FROM Schedule
            WHERE Ride_ID LIKE 'RIDE%'
            GROUP BY Ride_ID
            ORDER BY Ride_ID DESC
            LIMIT 1
        """)
        result = cursor.fetchone()

        if result:
            last_id = result[0]
            number = int(last_id[4:])  # remove "RIDE"
            new_number = number + 1
        else:
            new_number = 1

        return f"RIDE{new_number:04d}"
    except Exception as e:
        print(f"Error generating Ride ID: {e}")
        return f"RIDE{int(datetime.now().timestamp())}"
    finally:
        cursor.close()


def get_company_id_for_admin(admin_id):
    cursor = mysql.connection.cursor()
    try:
        cursor.execute(
            "SELECT Company_ID FROM MainAdmin WHERE Admin_ID=%s",
            (admin_id,)
        )
        row = cursor.fetchone()
        return row[0] if row else None
    finally:
        cursor.close()


def calculate_simple_eta(departure_times_list):
    """
    ETA calculation (segment-based):
    - First station ETA = 0
    - Next ETA = minutes difference vs previous station
    """
    sorted_departures = sorted(
        departure_times_list,
        key=lambda x: x.get('StopOrder', 0)
    )

    results = []
    prev_datetime = None

    for station_data in sorted_departures:
        route_station_id = station_data.get("RouteStation_ID")
        departure_time = station_data.get("departureTime")
        stop_order = station_data.get("StopOrder", 0)

        eta = None

        if departure_time and departure_time.strip() != "":
            try:
                try:
                    current_datetime = datetime.strptime(departure_time, "%H:%M:%S")
                except ValueError:
                    current_datetime = datetime.strptime(departure_time, "%H:%M")

                if prev_datetime:
                    diff = current_datetime - prev_datetime
                    minutes_diff = int(diff.total_seconds() / 60)
                    if minutes_diff < 0:
                        minutes_diff += 24 * 60  # wrap around midnight
                    eta = minutes_diff
                else:
                    eta = 0

                prev_datetime = current_datetime
            except ValueError as e:
                print(f"Error parsing departure time {departure_time}: {e}")
                eta = None

        results.append({
            "RouteStation_ID": route_station_id,
            "departureTime": departure_time,
            "ETA": eta,
            "StopOrder": stop_order,
        })

    return results


def get_next_broadcast_message_id():
    """Generate next sequential message ID for broadcast channel"""
    cursor = mysql.connection.cursor()
    try:
        cursor.execute("""
            SELECT Message_ID 
            FROM BroadcastChannel_Message 
            WHERE Message_ID LIKE 'MSG%' 
            ORDER BY CAST(SUBSTRING(Message_ID, 4) AS UNSIGNED) DESC 
            LIMIT 1
        """)
        result = cursor.fetchone()
        
        if result and result[0]:
            last_num = int(result[0][3:])
            next_num = last_num + 1
        else:
            next_num = 1
            
        return f"MSG{next_num:03d}"
    except Exception as e:
        print(f"Error generating broadcast message ID: {e}")
        return f"MSG{int(datetime.now().timestamp())}"
    finally:
        cursor.close()


def create_auto_announcement(admin_id, title, content):
    """
    Insert an announcement using the same pattern as announcement_bp:
    Announce1, Announce2, ...
    """
    cursor = mysql.connection.cursor()
    try:
        # get last Announce_ID in numeric order
        cursor.execute("""
            SELECT Announce_ID
            FROM Announcements
            ORDER BY CAST(SUBSTRING(Announce_ID, 9) AS UNSIGNED) DESC
            LIMIT 1
        """)
        last_id = cursor.fetchone()

        if last_id:
            try:
                last_num = int(last_id[0].replace("Announce", ""))
            except ValueError:
                last_num = 0
            new_num = last_num + 1
        else:
            new_num = 1

        announce_id = f"Announce{new_num}"
        date_time = datetime.utcnow()

        cursor.execute("""
            INSERT INTO Announcements (Announce_ID, Admin_ID, title, date_time, content)
            VALUES (%s, %s, %s, %s, %s)
        """, (announce_id, admin_id, title, date_time, content))

        mysql.connection.commit()
    except Exception as e:
        mysql.connection.rollback()
        print("Error creating auto announcement:", e)
    finally:
        cursor.close()


def send_to_broadcast_channel(admin_id, message_content):
    """
    Send a message to the 'everyone' broadcast channel
    This mirrors the announcement to the broadcast system
    """
    cursor = mysql.connection.cursor()
    try:
        message_id = get_next_broadcast_message_id()
        sent_at = datetime.now()
        
        cursor.execute("""
            INSERT INTO BroadcastChannel_Message 
            (Message_ID, Sender_MainAdmin_ID, Message_Content, Sent_At)
            VALUES (%s, %s, %s, %s)
        """, (message_id, admin_id, message_content, sent_at))
        
        mysql.connection.commit()
        print(f"Broadcast message sent: {message_id}")
        return message_id
    except Exception as e:
        mysql.connection.rollback()
        print(f"Error sending broadcast message: {e}")
        return None
    finally:
        cursor.close()


def create_announcement_and_broadcast(admin_id, title, content):
    """
    Create both an announcement AND send to broadcast channel
    This ensures users see it in both places
    """
    # Create announcement (for announcements page)
    create_auto_announcement(admin_id, title, content)
    
    # Send to broadcast channel (for real-time chat)
    broadcast_message = f"📢 {title}\n\n{content}"
    send_to_broadcast_channel(admin_id, broadcast_message)


# =========================
# Routes API
# =========================

@schedules_bp.route('/routes', methods=['GET'])
@jwt_required()
def fetch_routes():
    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        if not company_id:
            return jsonify([]), 200

        cursor = mysql.connection.cursor()
        try:
            cursor.execute("""
                SELECT Route_ID, Route_name, is_active
                FROM Route
                WHERE Company_ID=%s
                ORDER BY Route_name
            """, (company_id,))
            rows = cursor.fetchall()

            result = [{
                "Route_ID": r[0],
                "Route_name": r[1],
                "is_active": int(r[2]) if r[2] is not None else 1,
            } for r in rows]

            return jsonify(result)
        finally:
            cursor.close()
    except Exception as e:
        print("Error fetching routes:", e)
        return jsonify({"error": str(e)}), 500


@schedules_bp.route('/stations', methods=['GET'])
@jwt_required()
def fetch_route_stations():
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
            cursor.execute("""
                SELECT Route_ID
                FROM Route
                WHERE Route_ID=%s AND Company_ID=%s
            """, (route_id, company_id))
            if not cursor.fetchone():
                return jsonify({"error": "Route not found or access denied"}), 404

            cursor.execute("""
                SELECT RouteStation_ID, Station_ID, StationName, StopOrder
                FROM RouteStations
                WHERE Route_ID=%s
                ORDER BY StopOrder ASC
            """, (route_id,))
            rows = cursor.fetchall()

            result = [{
                "RouteStation_ID": r[0],
                "Station_ID": r[1],
                "StationName": r[2],
                "StopOrder": r[3],
            } for r in rows]

            return jsonify(result)
        finally:
            cursor.close()
    except Exception as e:
        print("Error fetching stations:", e)
        return jsonify({"error": str(e)}), 500


@schedules_bp.route('/vehicles', methods=['GET'])
@jwt_required()
def fetch_vehicles():
    """Simple list of vehicles to show in dropdown."""
    try:
        cursor = mysql.connection.cursor()
        cursor.execute("""
            SELECT Vehicle_ID, vehicleType, Capacity
            FROM Vehicle
            ORDER BY Vehicle_ID
        """)
        rows = cursor.fetchall()
        cursor.close()

        result = [{
            "Vehicle_ID": r[0],
            "vehicleType": r[1],
            "capacity": r[2],
        } for r in rows]

        return jsonify(result)
    except Exception as e:
        print("Error fetching vehicles:", e)
        return jsonify({"error": str(e)}), 500


# =========================
# Create / Update / Delete Ride
# =========================

@schedules_bp.route('/create', methods=['POST'])
@jwt_required()
def create_ride():
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
            cursor.execute("""
                SELECT Route_ID, Route_name
                FROM Route
                WHERE Route_ID=%s AND Company_ID=%s
            """, (route_id, company_id))
            route_row = cursor.fetchone()
            if not route_row:
                return jsonify({"error": "Route not found or access denied"}), 404

            ride_id = generate_ride_id()
            calculated_stations = calculate_simple_eta(departure_times)

            for st in calculated_stations:
                schedule_id = generate_schedule_id()
                cursor.execute("""
                    INSERT INTO Schedule (
                        Schedule_ID,
                        Ride_ID,
                        Route_ID,
                        RouteStation_ID,
                        departureTime,
                        ETA,
                        Vehicle_ID,
                        is_active
                    )
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                """, (
                    schedule_id,
                    ride_id,
                    route_id,
                    st["RouteStation_ID"],
                    st["departureTime"],
                    st["ETA"],
                    None,
                    1,
                ))

            mysql.connection.commit()
            return jsonify({"message": "Ride created successfully", "Ride_ID": ride_id}), 201
        except Exception as e:
            mysql.connection.rollback()
            raise e
        finally:
            cursor.close()
    except Exception as e:
        print("Error creating ride:", e)
        return jsonify({"error": str(e)}), 500


@schedules_bp.route('/update/<ride_id>', methods=['PUT'])
@jwt_required()
def update_ride(ride_id):
    data = request.json
    departure_times = data.get('departureTimes')
    vehicle_id = data.get('Vehicle_ID')

    if not departure_times:
        return jsonify({"error": "departureTimes are required"}), 400

    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        if not company_id:
            return jsonify({"error": "Company not found"}), 400

        cursor = mysql.connection.cursor()
        try:
            cursor.execute("""
                SELECT DISTINCT r.Route_ID, r.Route_name
                FROM Schedule s
                JOIN Route r ON s.Route_ID = r.Route_ID
                WHERE s.Ride_ID=%s AND r.Company_ID=%s
            """, (ride_id, company_id))
            row = cursor.fetchone()
            if not row:
                return jsonify({"error": "Ride not found or access denied"}), 404

            calculated_stations = calculate_simple_eta(departure_times)

            for st in calculated_stations:
                cursor.execute("""
                    UPDATE Schedule
                    SET departureTime=%s,
                        ETA=%s,
                        Vehicle_ID=%s
                    WHERE Ride_ID=%s
                      AND RouteStation_ID=%s
                """, (
                    st["departureTime"],
                    st["ETA"],
                    vehicle_id,
                    ride_id,
                    st["RouteStation_ID"],
                ))

            mysql.connection.commit()
            return jsonify({"message": "Ride updated successfully"})
        except Exception as e:
            mysql.connection.rollback()
            raise e
        finally:
            cursor.close()
    except Exception as e:
        print("Error updating ride:", e)
        return jsonify({"error": str(e)}), 500


@schedules_bp.route('/delete/<ride_id>', methods=['DELETE'])
@jwt_required()
def delete_ride(ride_id):
    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        if not company_id:
            return jsonify({"error": "Company not found"}), 400

        cursor = mysql.connection.cursor()
        try:
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
        print("Error deleting ride:", e)
        return jsonify({"error": str(e)}), 500


# =========================
# Schedules by Route
# =========================

@schedules_bp.route('/by-route', methods=['GET'])
@jwt_required()
def get_schedules_by_route():
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
            cursor.execute("""
                SELECT Route_ID, Route_name, is_active
                FROM Route
                WHERE Route_ID=%s AND Company_ID=%s
            """, (route_id, company_id))
            route_row = cursor.fetchone()
            if not route_row:
                return jsonify({"error": "Route not found or access denied"}), 404

            route_is_active = int(route_row[2]) if route_row[2] is not None else 1

            cursor.execute("""
                SELECT 
                    s.Ride_ID,
                    s.RouteStation_ID,
                    s.departureTime,
                    s.ETA,
                    s.Vehicle_ID,
                    s.is_active,
                    rs.Station_ID,
                    rs.StationName,
                    rs.StopOrder
                FROM Schedule s
                JOIN RouteStations rs 
                    ON s.RouteStation_ID = rs.RouteStation_ID
                JOIN Route r
                    ON s.Route_ID = r.Route_ID
                WHERE s.Route_ID=%s
                  AND r.Company_ID=%s
                ORDER BY s.Ride_ID, rs.StopOrder
            """, (route_id, company_id))
            rows = cursor.fetchall()

            rides = {}
            for r in rows:
                ride_id_row = r[0]
                route_station_id = r[1]
                departure_time = r[2]
                eta = r[3]
                vehicle_id = r[4]
                sched_active = int(r[5]) if r[5] is not None else 1
                station_id = r[6]
                station_name = r[7]
                stop_order = r[8]

                if ride_id_row not in rides:
                    rides[ride_id_row] = {
                        "Ride_ID": ride_id_row,
                        "Vehicle_ID": vehicle_id,
                        "is_active": sched_active,
                        "route_is_active": route_is_active,
                        "stations": [],
                    }

                rides[ride_id_row]["stations"].append({
                    "RouteStation_ID": route_station_id,
                    "Station_ID": station_id,
                    "StationName": station_name,
                    "StopOrder": stop_order,
                    "Schedule_ID": None,
                    "departureTime": str(departure_time) if departure_time else None,
                    "ETA": eta,
                    "is_active": sched_active,
                })

            return jsonify(list(rides.values()))
        finally:
            cursor.close()
    except Exception as e:
        print("Error fetching schedules:", e)
        return jsonify({"error": str(e)}), 500


# =========================
# Assign Vehicle to Ride
# =========================

@schedules_bp.route('/assign-vehicle', methods=['PUT'])
@jwt_required()
def assign_vehicle():
    data = request.json
    ride_id = data.get("Ride_ID")
    vehicle_id = data.get("Vehicle_ID")

    if not ride_id or not vehicle_id:
        return jsonify({"error": "Ride_ID and Vehicle_ID are required"}), 400

    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        if not company_id:
            return jsonify({"error": "Company not found"}), 400

        cursor = mysql.connection.cursor()
        try:
            cursor.execute("""
                SELECT DISTINCT r.Route_ID
                FROM Schedule s
                JOIN Route r ON s.Route_ID = r.Route_ID
                WHERE s.Ride_ID=%s AND r.Company_ID=%s
            """, (ride_id, company_id))
            if not cursor.fetchone():
                return jsonify({"error": "Ride not found or access denied"}), 404

            cursor.execute("""
                UPDATE Schedule
                SET Vehicle_ID=%s
                WHERE Ride_ID=%s
            """, (vehicle_id, ride_id))

            mysql.connection.commit()
            return jsonify({"message": "Vehicle assigned successfully"})
        except Exception as e:
            mysql.connection.rollback()
            raise e
        finally:
            cursor.close()
    except Exception as e:
        print("Error assigning vehicle:", e)
        return jsonify({"error": str(e)}), 500


# =========================
# Suspend / Resume Route (with auto-announcement AND broadcast)
# =========================

@schedules_bp.route('/suspend-route', methods=['POST'])
@jwt_required()
def suspend_route():
    data = request.json
    route_id = data.get("Route_ID")
    reason = data.get("Reason")

    if not route_id or not reason:
        return jsonify({"error": "Route_ID and Reason are required"}), 400

    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        if not company_id:
            return jsonify({"error": "Company not found"}), 400

        cursor = mysql.connection.cursor()
        try:
            cursor.execute("""
                SELECT Route_ID, Route_name
                FROM Route
                WHERE Route_ID=%s AND Company_ID=%s
            """, (route_id, company_id))
            row = cursor.fetchone()
            if not row:
                return jsonify({"error": "Route not found or access denied"}), 404

            route_name = row[1]

            cursor.execute("""
                UPDATE Route
                SET is_active = 0
                WHERE Route_ID=%s AND Company_ID=%s
            """, (route_id, company_id))

            cursor.execute("""
                UPDATE Schedule
                SET is_active = 0
                WHERE Route_ID=%s
            """, (route_id,))

            mysql.connection.commit()

            # Create announcement AND send to broadcast channel
            title = "⚠ Operations Suspended"
            content = (
                f"All schedules for {route_name} have been suspended.\n"
                f"Reason: {reason}"
            )
            create_announcement_and_broadcast(admin_id, title, content)

            return jsonify({"message": "Route suspended, announcement and broadcast created"})
        except Exception as e:
            mysql.connection.rollback()
            raise e
        finally:
            cursor.close()
    except Exception as e:
        print("Error suspending route:", e)
        return jsonify({"error": str(e)}), 500


@schedules_bp.route('/resume-route', methods=['POST'])
@jwt_required()
def resume_route():
    data = request.json
    route_id = data.get("Route_ID")

    if not route_id:
        return jsonify({"error": "Route_ID is required"}), 400

    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        if not company_id:
            return jsonify({"error": "Company not found"}), 400

        cursor = mysql.connection.cursor()
        try:
            cursor.execute("""
                SELECT Route_ID, Route_name
                FROM Route
                WHERE Route_ID=%s AND Company_ID=%s
            """, (route_id, company_id))
            row = cursor.fetchone()
            if not row:
                return jsonify({"error": "Route not found or access denied"}), 404

            route_name = row[1]

            cursor.execute("""
                UPDATE Route
                SET is_active = 1
                WHERE Route_ID=%s AND Company_ID=%s
            """, (route_id, company_id))

            cursor.execute("""
                UPDATE Schedule
                SET is_active = 1
                WHERE Route_ID=%s
            """, (route_id,))

            mysql.connection.commit()

            # Create announcement AND send to broadcast channel
            title = "✅ Operations Resumed"
            content = f"Operations for {route_name} have resumed and schedules are now active."
            create_announcement_and_broadcast(admin_id, title, content)

            return jsonify({"message": "Route resumed, announcement and broadcast created"})
        except Exception as e:
            mysql.connection.rollback()
            raise e
        finally:
            cursor.close()
    except Exception as e:
        print("Error resuming route:", e)
        return jsonify({"error": str(e)}), 500


# =========================
# Test Endpoint
# =========================

@schedules_bp.route('/test', methods=['GET'])
@jwt_required()
def test_endpoint():
    return jsonify({
        "message": "Schedules backend is working!",
        "timestamp": datetime.now().isoformat()
    })
