from flask import Blueprint, jsonify, request
from app import mysql
from flask_jwt_extended import jwt_required, get_jwt_identity

passenger_bp = Blueprint("passenger_bp", __name__)

# -------------------------
# Get all passengers (optionally filter by platform_source) - public
# -------------------------
@passenger_bp.route("/", methods=["GET"])
def get_passengers():
    platform = request.args.get("platform", None)  # ?platform=MA
    cur = mysql.connection.cursor()
    if platform and platform != "all":
        cur.execute("SELECT * FROM Users WHERE platform_source = %s", (platform,))
    else:
        cur.execute("SELECT * FROM Users")
    users = cur.fetchall()
    cur.close()
    return jsonify(users)


# -------------------------
# Delete a passenger by User_ID (protected)
# -------------------------
@passenger_bp.route("/<user_id>", methods=["DELETE"])
@jwt_required()
def delete_passenger(user_id):
    current_user = get_jwt_identity()  # ✅ track who deleted
    cur = mysql.connection.cursor()
    cur.execute("DELETE FROM Users WHERE User_ID = %s", (user_id,))
    mysql.connection.commit()
    cur.close()
    return jsonify({"message": f"User {user_id} deleted successfully by {current_user}."})
