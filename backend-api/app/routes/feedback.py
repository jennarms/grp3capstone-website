from flask import Blueprint, jsonify, request
from app import mysql
from flask_jwt_extended import jwt_required, get_jwt_identity

feedback_bp = Blueprint("feedback", __name__)

# 🔹 Category mapping
CATEGORY_MAP = {
    "CP": "Complaint",
    "CM": "Compliment",
    "SG": "Suggestion",
    "IN": "Inquiry",
}
# Reverse mapping for filtering
REVERSE_CATEGORY_MAP = {v: k for k, v in CATEGORY_MAP.items()}


# 🔹 Fetch all feedback (public)
@feedback_bp.route("/", methods=["GET"])
def get_feedback():
    cur = mysql.connection.cursor()

    # Get global settings
    cur.execute("SELECT enabled, message FROM FeedbackSettings LIMIT 1")
    settings = cur.fetchone()
    settings_enabled = settings[0] if settings else False
    settings_message = settings[1] if settings else ""

    query = """
        SELECT Feedback_ID, User_ID, datetime, category, rating, message, 
               image, full_name, station, auto_reply, feedback_source
        FROM Feedback
        ORDER BY datetime DESC
    """
    cur.execute(query)
    rows = cur.fetchall()
    cur.close()

    feedback_list = []
    for r in rows:
        # ✅ If enabled, force the global message to show in UI
        reply_value = settings_message if settings_enabled else r[9]

        feedback_list.append({
            "id": r[0],
            "userId": r[1],
            "date": r[2].strftime("%Y-%m-%d %H:%M:%S") if r[2] else None,
            "category": CATEGORY_MAP.get(r[3], r[3]),
            "rating": r[4],
            "message": r[5],
            "image": r[6],
            "full_name": r[7],
            "station": r[8],
            "adminResponse": reply_value,
            "source": r[10],
        })

    return jsonify(feedback_list)


# 🔹 Delete feedback (protected)
@feedback_bp.route("/<fid>", methods=["DELETE"])
@jwt_required()
def delete_feedback(fid):
    current_user = get_jwt_identity()  # ✅ log who deleted
    cur = mysql.connection.cursor()
    cur.execute("DELETE FROM Feedback WHERE Feedback_ID = %s", (fid,))
    mysql.connection.commit()
    cur.close()
    return jsonify({"success": True, "message": f"Feedback {fid} deleted by {current_user}"})


# 🔹 Update reply for a specific feedback (protected)
@feedback_bp.route("/<fid>/reply", methods=["PUT"])
@jwt_required()
def reply_feedback(fid):
    current_user = get_jwt_identity()
    data = request.json
    reply = data.get("reply")
    if not reply:
        return jsonify({"success": False, "message": "Reply text required"}), 400

    # If global auto-reply is enabled, block manual reply updates
    cur = mysql.connection.cursor()
    cur.execute("SELECT enabled FROM FeedbackSettings LIMIT 1")
    row = cur.fetchone()
    if row and row[0]:  # enabled == True
        cur.close()
        return jsonify({
            "success": False,
            "message": "Global auto-reply is enabled. Disable it to set per-feedback replies."
        }), 403

    cur.execute("UPDATE Feedback SET auto_reply = %s WHERE Feedback_ID = %s", (reply, fid))
    mysql.connection.commit()
    cur.close()

    return jsonify({"success": True, "message": f"Reply updated by {current_user}"})


# 🔹 Get global feedback settings (public)
@feedback_bp.route("/settings", methods=["GET"])
def get_feedback_settings():
    cur = mysql.connection.cursor()
    cur.execute("SELECT id, enabled, message FROM FeedbackSettings LIMIT 1")
    row = cur.fetchone()
    cur.close()

    if not row:
        return jsonify({"enabled": False, "message": ""})

    return jsonify({
        "id": row[0],
        "enabled": bool(row[1]),
        "message": row[2]
    })


# 🔹 Update global feedback settings (protected)
@feedback_bp.route("/settings", methods=["PUT"])
@jwt_required()
def update_feedback_settings():
    current_user = get_jwt_identity()
    data = request.json
    enabled = bool(data.get("enabled", False))
    message = data.get("message", "")

    cur = mysql.connection.cursor()
    cur.execute("""
        UPDATE FeedbackSettings
        SET enabled = %s, message = %s
        WHERE id = 1
    """, (enabled, message))
    mysql.connection.commit()
    cur.close()

    return jsonify({"success": True, "message": f"Settings updated by {current_user}"})
