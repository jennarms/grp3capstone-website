from flask import Blueprint, request, jsonify
from app import mysql
from datetime import datetime
import traceback

announcement_bp = Blueprint("announcement", __name__)

# =====================
# GET ALL ANNOUNCEMENTS
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

        announcements = [
            {
                "announce_id": row[0],
                "title": row[1],
                "content": row[2],
                "date_time": row[3].strftime("%Y-%m-%d %H:%M:%S"),
                "admin_name": row[4],
            }
            for row in result
        ]

        return jsonify({"announcements": announcements}), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


# =====================
# CREATE ANNOUNCEMENT
# =====================
@announcement_bp.route("", methods=["POST"])
def create_announcement():
    data = request.get_json()
    title = data.get("title")
    content = data.get("content")
    admin_id = data.get("admin_id")  # 🔹 Client must send admin_id

    if not title or not content or not admin_id:
        return jsonify({"error": "Title, content, and admin_id are required"}), 400

    try:
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
        date_time = datetime.utcnow()

        cur.execute(
            """
            INSERT INTO Announcements (Announce_ID, Admin_ID, title, date_time, content)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (announce_id, admin_id, title, date_time, content),
        )
        mysql.connection.commit()

        # ✅ Fetch admin_name for the response
        cur.execute("SELECT username FROM MainAdmin WHERE Admin_ID = %s", (admin_id,))
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
# UPDATE ANNOUNCEMENT
# =====================
@announcement_bp.route("/<announce_id>", methods=["PUT"])
def update_announcement(announce_id):
    data = request.get_json()
    title = data.get("title")
    content = data.get("content")
    admin_id = data.get("admin_id")

    if not title or not content or not admin_id:
        return jsonify({"error": "Title, content, and admin_id are required"}), 400

    try:
        cur = mysql.connection.cursor()
        cur.execute(
            """
            UPDATE Announcements
            SET title = %s, content = %s
            WHERE Announce_ID = %s AND Admin_ID = %s
            """,
            (title, content, announce_id, admin_id),
        )
        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Announcement updated successfully"}), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


# =====================
# DELETE ANNOUNCEMENT
# =====================
@announcement_bp.route("/<announce_id>", methods=["DELETE"])
def delete_announcement(announce_id):
    data = request.get_json()
    admin_id = data.get("admin_id")

    if not admin_id:
        return jsonify({"error": "admin_id is required"}), 400

    try:
        cur = mysql.connection.cursor()
        cur.execute(
            "DELETE FROM Announcements WHERE Announce_ID = %s AND Admin_ID = %s",
            (announce_id, admin_id),
        )
        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Announcement deleted successfully"}), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500
