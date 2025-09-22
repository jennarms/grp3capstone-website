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
# Update vehicle capacity ONLY (requires JWT)
# -------------------------
@vehicle_bp.route("/capacity", methods=["PUT"])
@jwt_required()
def update_capacity():
    try:
        data = request.get_json()
        capacity = data.get("capacity")

        if capacity is None:
            return jsonify({"error": "Capacity is required"}), 400

        if not isinstance(capacity, int) or capacity < 0:
            return jsonify({"error": "Capacity must be a non-negative integer"}), 400

        cur = mysql.connection.cursor()

        # Check if a vehicle exists
        cur.execute("SELECT Vehicle_ID FROM Vehicle LIMIT 1")
        row = cur.fetchone()

        if not row:
            return jsonify({"error": "No vehicle found to update"}), 404

        # Update only capacity
        cur.execute(
            "UPDATE Vehicle SET Capacity=%s WHERE Vehicle_ID=%s",
            (capacity, row[0])
        )
        
        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Vehicle capacity updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -------------------------
# Update vehicle type ONLY (requires JWT) - DANGEROUS OPERATION
# -------------------------
@vehicle_bp.route("/type", methods=["PUT"])
@jwt_required()
def update_vehicle_type():
    try:
        data = request.get_json()
        vehicle_type = data.get("vehicleType")
        confirmation_code = data.get("confirmationCode")

        if not vehicle_type:
            return jsonify({"error": "Vehicle type is required"}), 400

        if not confirmation_code:
            return jsonify({"error": "Confirmation code is required"}), 400

        # Validate confirmation code (must be exactly "CONFIRM")
        if confirmation_code != "CONFIRM":
            return jsonify({"error": "Invalid confirmation code. Type 'CONFIRM' exactly."}), 400

        # Validate vehicle type
        if vehicle_type not in ALLOWED_TYPES:
            return jsonify({"error": f"Invalid vehicle type. Allowed: {', '.join(ALLOWED_TYPES)}"}), 400

        cur = mysql.connection.cursor()

        # Check if a vehicle exists
        cur.execute("SELECT Vehicle_ID, vehicleType FROM Vehicle LIMIT 1")
        row = cur.fetchone()

        if not row:
            return jsonify({"error": "No vehicle found to update"}), 404

        current_type = row[1]
        
        # Check if type is actually changing
        if current_type == vehicle_type:
            return jsonify({"message": "Vehicle type is already set to this value"}), 200

        # WARNING: This is a dangerous operation that may affect related data
        # Update only vehicle type
        cur.execute(
            "UPDATE Vehicle SET vehicleType=%s WHERE Vehicle_ID=%s",
            (vehicle_type, row[0])
        )
        
        mysql.connection.commit()
        cur.close()

        return jsonify({
            "message": "Vehicle type updated successfully", 
            "warning": "This change may have affected related data in the system"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -------------------------
# Save or create new vehicle (requires JWT) - For initial setup only
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
            return jsonify({"error": "Vehicle already exists. Use update endpoints instead."}), 400

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

        return jsonify({"message": "Vehicle created successfully", "vehicle_id": new_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -------------------------
# Get allowed vehicle types
# -------------------------
@vehicle_bp.route("/types", methods=["GET"])
@jwt_required()
def get_allowed_types():
    return jsonify({"types": ALLOWED_TYPES}), 200