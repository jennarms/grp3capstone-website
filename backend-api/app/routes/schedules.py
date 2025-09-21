from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import mysql
import re

schedules_bp = Blueprint('schedules', __name__)

# ---- Helper to generate next Schedule_ID ----
def generate_schedule_id():
    cursor = mysql.connection.cursor()
    cursor.execute("SELECT Schedule_ID FROM Schedule ORDER BY Schedule_ID DESC LIMIT 1;")
    last_id = cursor.fetchone()
    cursor.close()

    if last_id and last_id[0]:
        last_num = int(re.sub(r'[^0-9]', '', last_id[0]))
        new_num = last_num + 1
    else:
        new_num = 1

    return f"S{new_num:04d}"   # e.g. S0001, S0002

# ---- Auto calculate ETA (placeholder = +45 mins) ----
def calculate_eta(departure_time):
    from datetime import datetime, timedelta
    if not departure_time:
        return None
    dt = datetime.strptime(str(departure_time), "%H:%M:%S")
    eta_dt = dt + timedelta(minutes=45)
    return eta_dt.strftime("%H:%M:%S")

# ---- Create Schedule ----
@schedules_bp.route('/schedules', methods=['POST'])
@jwt_required()
def create_schedule():
    data = request.get_json()
    route_id = data.get('Route_ID')
    station_id = data.get('Station_ID')
    departure_time = data.get('departureTime')

    if not route_id or not station_id or not departure_time:
        return jsonify({"error": "Route_ID, Station_ID and departureTime are required"}), 400

    schedule_id = generate_schedule_id()
    eta = calculate_eta(departure_time)

    cursor = mysql.connection.cursor()
    try:
        cursor.execute("""
            INSERT INTO Schedule (Schedule_ID, Route_ID, Station_ID, departureTime, ETA)
            VALUES (%s, %s, %s, %s, %s)
        """, (schedule_id, route_id, station_id, departure_time, eta))
        mysql.connection.commit()
        return jsonify({
            "message": "Schedule created",
            "Schedule_ID": schedule_id,
            "ETA": eta
        }), 201
    except Exception as e:
        mysql.connection.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()

# ---- Read all Schedules ----
@schedules_bp.route('/schedules', methods=['GET'])
@jwt_required()
def get_schedules():
    cursor = mysql.connection.cursor()
    try:
        cursor.execute("SELECT * FROM Schedule")
        rows = cursor.fetchall()
        schedules = []
        for row in rows:
            schedules.append({
                "Schedule_ID": row[0],
                "Route_ID": row[1],
                "Station_ID": row[2],
                "departureTime": str(row[3]),
                "ETA": str(row[4])
            })
        return jsonify(schedules)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()

# ---- Update Schedule ----
@schedules_bp.route('/schedules/<schedule_id>', methods=['PUT'])
@jwt_required()
def update_schedule(schedule_id):
    data = request.get_json()
    route_id = data.get('Route_ID')
    station_id = data.get('Station_ID')
    departure_time = data.get('departureTime')

    eta = calculate_eta(departure_time) if departure_time else None

    cursor = mysql.connection.cursor()
    try:
        cursor.execute("""
            UPDATE Schedule
            SET Route_ID = %s, Station_ID = %s, departureTime = %s, ETA = %s
            WHERE Schedule_ID = %s
        """, (route_id, station_id, departure_time, eta, schedule_id))
        mysql.connection.commit()
        return jsonify({"message": "Schedule updated", "ETA": eta})
    except Exception as e:
        mysql.connection.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()

# ---- Delete Schedule ----
@schedules_bp.route('/schedules/<schedule_id>', methods=['DELETE'])
@jwt_required()
def delete_schedule(schedule_id):
    cursor = mysql.connection.cursor()
    try:
        cursor.execute("DELETE FROM Schedule WHERE Schedule_ID = %s", (schedule_id,))
        mysql.connection.commit()
        return jsonify({"message": "Schedule deleted"})
    except Exception as e:
        mysql.connection.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
