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
                "name": r[0],          # UI uses v.name → use Vehicle_ID for now
                "type": r[1],
                "capacity": r[2]
            })

        return jsonify(vehicles), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================
# 2. ADD VEHICLE
#    POST /api/vehicle/add
# =========================================================
@vehicle_bp.route("/add", methods=["POST"])
@jwt_required()
def add_vehicle():
    try:
        data = request.get_json()
        name = data.get("name")
        vehicle_type = data.get("type")
        capacity = data.get("capacity")

        if not name or not vehicle_type or capacity is None:
            return jsonify({"error": "Missing fields"}), 400

        if vehicle_type not in ALLOWED_TYPES:
            return jsonify({"error": "Invalid vehicle type"}), 400

        cur = mysql.connection.cursor()

        # Check if vehicle exists
        cur.execute("SELECT Vehicle_ID FROM Vehicle WHERE Vehicle_ID=%s", (name,))
        exists = cur.fetchone()
        if exists:
            cur.close()
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
# 3. UPDATE VEHICLE
#    PUT /api/vehicle/update/<vehicle_id>
# =========================================================
@vehicle_bp.route("/update/<vehicle_id>", methods=["PUT"])
@jwt_required()
def update_vehicle(vehicle_id):
    try:
        data = request.get_json()
        vehicle_type = data.get("type")
        capacity = data.get("capacity")

        if vehicle_type is None or capacity is None:
            return jsonify({"error": "Missing fields"}), 400

        if vehicle_type not in ALLOWED_TYPES:
            return jsonify({"error": "Invalid vehicle type"}), 400

        cur = mysql.connection.cursor()

        # Ensure vehicle exists
        cur.execute("SELECT Vehicle_ID FROM Vehicle WHERE Vehicle_ID=%s", (vehicle_id,))
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "Vehicle not found"}), 404

        # Update
        cur.execute(
            "UPDATE Vehicle SET vehicleType=%s, Capacity=%s WHERE Vehicle_ID=%s",
            (vehicle_type, capacity, vehicle_id)
        )

        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Vehicle updated successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================
# 4. DELETE VEHICLE
#    DELETE /api/vehicle/delete/<vehicle_id>
# =========================================================
@vehicle_bp.route("/delete/<vehicle_id>", methods=["DELETE"])
@jwt_required()
def delete_vehicle(vehicle_id):
    try:
        cur = mysql.connection.cursor()

        # Make sure it exists
        cur.execute("SELECT Vehicle_ID FROM Vehicle WHERE Vehicle_ID=%s", (vehicle_id,))
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "Vehicle not found"}), 404

        # Delete tracker rows first (to avoid FK issues)
        cur.execute("DELETE FROM Vehicle_Tracker WHERE Vehicle_ID=%s", (vehicle_id,))

        # Delete from Vehicle
        cur.execute("DELETE FROM Vehicle WHERE Vehicle_ID=%s", (vehicle_id,))

        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Vehicle deleted successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================
# 5. LIST ALL GPS ASSIGNMENTS (Vehicle_Tracker)
#    GET /api/vehicle/gps/all
# =========================================================
@vehicle_bp.route("/gps/all", methods=["GET"])
@jwt_required()
def get_all_gps_assignments():
    try:
        cur = mysql.connection.cursor()
        cur.execute("""
            SELECT Vehicle_ID, device_id, active_from, active_to
            FROM Vehicle_Tracker
            ORDER BY Vehicle_ID, device_id
        """)
        rows = cur.fetchall()
        cur.close()

        trackers = []
        for r in rows:
            trackers.append({
                "vehicle": r[0],
                "gpsCode": r[1],
                "activeFrom": r[2].isoformat() if r[2] else None,
                "activeTo": r[3].isoformat() if r[3] else None,
            })

        return jsonify(trackers), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================
# 6. ASSIGN GPS DEVICE (create tracker row)
#    POST /api/vehicle/gps/assign
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
            cur.close()
            return jsonify({"error": "Vehicle not found"}), 404

        # Validate GPS exists
        cur.execute("SELECT device_id FROM Gps_Device WHERE device_id=%s", (gps_code,))
        gps_exists = cur.fetchone()
        if not gps_exists:
            cur.close()
            return jsonify({"error": "GPS device not found"}), 404

        # Optional: avoid duplicate pair
        cur.execute(
            "SELECT 1 FROM Vehicle_Tracker WHERE Vehicle_ID=%s AND device_id=%s",
            (vehicle, gps_code)
        )
        if cur.fetchone():
            cur.close()
            return jsonify({"error": "This GPS is already assigned to that vehicle"}), 400

        # Insert into tracker
        cur.execute("""
            INSERT INTO Vehicle_Tracker (Vehicle_ID, device_id, active_from)
            VALUES (%s, %s, NOW())
        """, (vehicle, gps_code))

        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "GPS assigned successfully"}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================
# 7. UPDATE GPS ASSIGNMENT
#    PUT /api/vehicle/gps/update
#    body: { "vehicle": "...", "oldGpsCode": "...", "newGpsCode": "..." }
# =========================================================
@vehicle_bp.route("/gps/update", methods=["PUT"])
@jwt_required()
def update_gps_assignment():
    try:
        data = request.get_json()
        vehicle = data.get("vehicle")
        old_gps = data.get("oldGpsCode")
        new_gps = data.get("newGpsCode")

        if not vehicle or not old_gps or not new_gps:
            return jsonify({"error": "Missing fields"}), 400

        cur = mysql.connection.cursor()

        # Ensure existing tracker row
        cur.execute(
            "SELECT 1 FROM Vehicle_Tracker WHERE Vehicle_ID=%s AND device_id=%s",
            (vehicle, old_gps)
        )
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "Existing GPS assignment not found"}), 404

        # Validate new GPS exists
        cur.execute("SELECT device_id FROM Gps_Device WHERE device_id=%s", (new_gps,))
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "New GPS device not found"}), 404

        # Optional: check duplicate new pair
        cur.execute(
            "SELECT 1 FROM Vehicle_Tracker WHERE Vehicle_ID=%s AND device_id=%s",
            (vehicle, new_gps)
        )
        if cur.fetchone():
            cur.close()
            return jsonify({"error": "That GPS is already assigned to this vehicle"}), 400

        # Update device_id
        cur.execute(
            "UPDATE Vehicle_Tracker SET device_id=%s WHERE Vehicle_ID=%s AND device_id=%s",
            (new_gps, vehicle, old_gps)
        )

        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "GPS assignment updated successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================
# 8. DELETE GPS ASSIGNMENT
#    DELETE /api/vehicle/gps/delete
#    body: { "vehicle": "...", "gpsCode": "..." }
# =========================================================
@vehicle_bp.route("/gps/delete", methods=["DELETE"])
@jwt_required()
def delete_gps_assignment():
    try:
        data = request.get_json()
        vehicle = data.get("vehicle")
        gps_code = data.get("gpsCode")

        if not vehicle or not gps_code:
            return jsonify({"error": "Missing fields"}), 400

        cur = mysql.connection.cursor()

        cur.execute(
            "SELECT 1 FROM Vehicle_Tracker WHERE Vehicle_ID=%s AND device_id=%s",
            (vehicle, gps_code)
        )
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "GPS assignment not found"}), 404

        cur.execute(
            "DELETE FROM Vehicle_Tracker WHERE Vehicle_ID=%s AND device_id=%s",
            (vehicle, gps_code)
        )

        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "GPS assignment deleted successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
