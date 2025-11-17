from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import mysql
from datetime import datetime
import traceback

announcement_bp = Blueprint("announcement", __name__)

# =====================
# GET ALL ANNOUNCEMENTS (public)
# =====================
@announcement_bp.route("", methods=["GET"])
def get_announcements():
    try:
        cur = mysql.connection.cursor()
        cur.execute(
            """
            SELECT a.Announce_ID, a.title, a.content, a.date_time, m.username AS admin_name
            FROM Announcements a
            JOIN MainAdmin m ON a.Admin_ID = m.Admin_ID
            ORDER BY a.date_time DESC
            """
        )
        result = cur.fetchall()
        cur.close()

        announcements = []
        for row in result:
            announcements.append({
                "announce_id": row[0],
                "title": row[1],
                "content": row[2],
                "date_time": row[3].strftime("%Y-%m-%d %H:%M:%S"),
                "admin_name": row[4],
            })

        return jsonify({"announcements": announcements}), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


# =====================
# CREATE ANNOUNCEMENT (admin only)
# =====================
@announcement_bp.route("", methods=["POST"])
@jwt_required()
def create_announcement():
    try:
        current_user = get_jwt_identity()  # admin ID from token
        data = request.get_json()
        title = data.get("title")
        content = data.get("content")

        if not title or not content:
            return jsonify({"error": "Title and content are required"}), 400

        cur = mysql.connection.cursor()

        # ✅ Get the latest Announce_ID using numeric order
        cur.execute(
            """
            SELECT Announce_ID 
            FROM Announcements
            ORDER BY CAST(SUBSTRING(Announce_ID, 9) AS UNSIGNED) DESC
            LIMIT 1
            """
        )
        last_id = cur.fetchone()

        if last_id:
            try:
                last_num = int(last_id[0].replace("Announce", ""))
            except ValueError:
                last_num = 0
            new_num = last_num + 1
        else:
            new_num = 1

        announce_id = f"Announce{new_num}"
        
        # ✅ Use datetime.now() instead of datetime.utcnow()
        date_time = datetime.now()

        cur.execute(
            """
            INSERT INTO Announcements (Announce_ID, Admin_ID, title, date_time, content)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (announce_id, current_user, title, date_time, content),
        )
        mysql.connection.commit()

        # ✅ Fetch admin_name for the response
        cur.execute("SELECT username FROM MainAdmin WHERE Admin_ID = %s", (current_user,))
        admin_row = cur.fetchone()
        admin_name = admin_row[0] if admin_row else "Unknown"

        cur.close()

        return jsonify(
            {
                "message": "Announcement created successfully",
                "announcement": {
                    "announce_id": announce_id,
                    "title": title,
                    "content": content,
                    "date_time": date_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "admin_name": admin_name,
                },
            }
        ), 201

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


# =====================
# UPDATE ANNOUNCEMENT (admin only)
# =====================
@announcement_bp.route("/<announce_id>", methods=["PUT"])
@jwt_required()
def update_announcement(announce_id):
    try:
        current_user = get_jwt_identity()
        data = request.get_json()
        title = data.get("title")
        content = data.get("content")

        if not title or not content:
            return jsonify({"error": "Title and content are required"}), 400

        cur = mysql.connection.cursor()
        cur.execute(
            """
            UPDATE Announcements
            SET title = %s, content = %s
            WHERE Announce_ID = %s AND Admin_ID = %s
            """,
            (title, content, announce_id, current_user),
        )
        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Announcement updated successfully"}), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


# =====================
# DELETE ANNOUNCEMENT (admin only)
# =====================
@announcement_bp.route("/<announce_id>", methods=["DELETE"])
@jwt_required()
def delete_announcement(announce_id):
    try:
        current_user = get_jwt_identity()

        cur = mysql.connection.cursor()
        cur.execute(
            "DELETE FROM Announcements WHERE Announce_ID = %s AND Admin_ID = %s",
            (announce_id, current_user),
        )
        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Announcement deleted successfully"}), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500