from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import mysql

vehicle_bp = Blueprint("vehicle_bp", __name__)

ALLOWED_TYPES = [
    "Ferry",
    "Roll-on/Roll-off Vessels",
    "Bus",
    "Shuttle Vans"
]


# =========================================================
# 1. GET ALL VEHICLES (UI: Vehicle list)
# =========================================================
@vehicle_bp.route("/all", methods=["GET"])
@jwt_required()
def get_all_vehicles():
    try:
        cur = mysql.connection.cursor()
        cur.execute("SELECT Vehicle_ID, vehicleType, Capacity FROM Vehicle")
        rows = cur.fetchall()
        cur.close()

        vehicles = []
        for r in rows:
            vehicles.append({
                "id": r[0],
                "name": r[0],          # UI uses v.name → so use Vehicle_ID for now
                "type": r[1],
                "capacity": r[2]
            })

        return jsonify(vehicles), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500



# =========================================================
# 2. ADD VEHICLE (UI: Add vehicle modal)
#    POST /api/vehicle/add
# =========================================================
@vehicle_bp.route("/add", methods=["POST"])
@jwt_required()
def add_vehicle():
    try:
        data = request.get_json()
        name = data.get("name")               # UI variable = name
        vehicle_type = data.get("type")       # UI variable = type
        capacity = data.get("capacity")       # UI variable = capacity

        if not name or not vehicle_type or capacity is None:
            return jsonify({"error": "Missing fields"}), 400

        if vehicle_type not in ALLOWED_TYPES:
            return jsonify({"error": "Invalid vehicle type"}), 400

        cur = mysql.connection.cursor()

        # Check if vehicle exists
        cur.execute("SELECT Vehicle_ID FROM Vehicle WHERE Vehicle_ID=%s", (name,))
        exists = cur.fetchone()
        if exists:
            return jsonify({"error": "Vehicle already exists"}), 400

        cur.execute(
            "INSERT INTO Vehicle (Vehicle_ID, vehicleType, Capacity) VALUES (%s, %s, %s)",
            (name, vehicle_type, capacity)
        )

        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Vehicle added successfully"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500



# =========================================================
# 3. ASSIGN GPS DEVICE (UI: Save Assignment)
#    POST /api/gps/assign
# =========================================================
@vehicle_bp.route("/gps/assign", methods=["POST"])
@jwt_required()
def assign_gps():
    try:
        data = request.get_json()
        vehicle = data.get("vehicle")      # UI sends vehicle name
        gps_code = data.get("gpsCode")     # UI sends GPS device ID

        if not vehicle or not gps_code:
            return jsonify({"error": "Missing fields"}), 400

        cur = mysql.connection.cursor()

        # Validate vehicle exists
        cur.execute("SELECT Vehicle_ID FROM Vehicle WHERE Vehicle_ID=%s", (vehicle,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Vehicle not found"}), 404

        # Validate GPS exists
        cur.execute("SELECT device_id FROM Gps_Device WHERE device_id=%s", (gps_code,))
        gps_exists = cur.fetchone()
        if not gps_exists:
            return jsonify({"error": "GPS device not found"}), 404

        # Insert into tracker (Option A)
        cur.execute("""
            INSERT INTO Vehicle_Tracker (Vehicle_ID, device_id, active_from)
            VALUES (%s, %s, NOW())
        """, (vehicle, gps_code))

        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "GPS assigned successfully"}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500
