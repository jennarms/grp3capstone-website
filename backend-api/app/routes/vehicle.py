from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import mysql

vehicle_bp = Blueprint("vehicle", __name__)

# Allowed vehicle types
ALLOWED_TYPES = [
    "Ferry",
    "Roll-on/Roll-off Vessels",
    "Bus",
    "Shuttle Vans"
]

# -------------------------
# Get vehicle info (requires JWT)
# -------------------------
@vehicle_bp.route("/", methods=["GET"])
@jwt_required()
def get_vehicle():
    try:
        cur = mysql.connection.cursor()
        cur.execute("SELECT Vehicle_ID, vehicleType, Capacity FROM Vehicle LIMIT 1")
        row = cur.fetchone()
        cur.close()

        if not row:
            return jsonify({"message": "No vehicle data found"}), 404

        return jsonify({
            "id": row[0],       # ex: V1
            "type": row[1],
            "capacity": row[2]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -------------------------
# Save or update vehicle (requires JWT)
# -------------------------
@vehicle_bp.route("/", methods=["POST"])
@jwt_required()
def save_vehicle():
    try:
        data = request.get_json()
        vehicle_type = data.get("vehicleType")
        capacity = data.get("capacity")

        if not vehicle_type or capacity is None:
            return jsonify({"error": "Missing required fields"}), 400

        # Validate vehicle type
        if vehicle_type not in ALLOWED_TYPES:
            return jsonify({"error": f"Invalid vehicle type. Allowed: {', '.join(ALLOWED_TYPES)}"}), 400

        cur = mysql.connection.cursor()

        # Check if a vehicle already exists
        cur.execute("SELECT Vehicle_ID FROM Vehicle LIMIT 1")
        row = cur.fetchone()

        if row:
            # Update existing
            cur.execute(
                "UPDATE Vehicle SET vehicleType=%s, Capacity=%s WHERE Vehicle_ID=%s",
                (vehicle_type, capacity, row[0])
            )
        else:
            # Generate custom ID (V1, V2, ...)
            cur.execute("SELECT COUNT(*) FROM Vehicle")
            count = cur.fetchone()[0]
            new_id = f"V{count + 1}"

            cur.execute(
                "INSERT INTO Vehicle (Vehicle_ID, vehicleType, Capacity) VALUES (%s, %s, %s)",
                (new_id, vehicle_type, capacity)
            )

        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Vehicle saved successfully"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
