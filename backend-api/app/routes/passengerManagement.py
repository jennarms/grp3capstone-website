from flask import Blueprint, jsonify, request
from app import mysql

passenger_bp = Blueprint("passenger_bp", __name__)

# -------------------------
# Get all passengers (optionally filter by platform_source)
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
# Delete a passenger by User_ID
# -------------------------
@passenger_bp.route("/<user_id>", methods=["DELETE"])
def delete_passenger(user_id):
    cur = mysql.connection.cursor()
    cur.execute("DELETE FROM Users WHERE User_ID = %s", (user_id,))
    mysql.connection.commit()
    cur.close()
    return jsonify({"message": f"User {user_id} deleted successfully."})
