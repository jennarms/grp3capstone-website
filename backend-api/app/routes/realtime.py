from flask import Blueprint, Response, jsonify
from flask_jwt_extended import jwt_required
from app import mysql
import json

realtime_bp = Blueprint('realtime', __name__)

def dictfetchall(cursor):
    cols = [col[0] for col in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]

@realtime_bp.route('/sos', methods=['GET'])
@jwt_required(locations=["headers", "query_string"])
def get_realtime_sos():
    """
    GET /api/realtime/sos
    Returns current open SOS alerts

    JWT is accepted from:
      - Authorization header:  Bearer <token>
      - Query string:          ?jwt=<token>
    """
    cursor = mysql.connection.cursor()

    try:
        cursor.execute(
            """
            SELECT 
                s.SOS_ID,
                s.User_ID,
                s.Station_ID,
                s.timestamp,
                s.status,
                s.latitude,
                s.longitude,
                st.StationName,
                u.first_name,
                u.last_name
            FROM SOS s
            LEFT JOIN Station st ON st.Station_ID = s.Station_ID
            LEFT JOIN Users u ON u.User_ID = s.User_ID
            WHERE s.status = 'PN'
            ORDER BY s.timestamp DESC
            LIMIT 50
            """
        )

        rows = dictfetchall(cursor)

        items = []
        for row in rows:
            first = row.get("first_name") or ""
            last = row.get("last_name") or ""
            name = f"{first} {last}".strip() or row.get("User_ID") or "Unknown"

            items.append({
                "id": row.get("SOS_ID"),
                "userId": row.get("User_ID"),
                "userName": name,
                "stationId": row.get("Station_ID"),
                "boardingStation": row.get("StationName") or "Unknown",
                "timestamp": row.get("timestamp").isoformat() if row.get("timestamp") else None,
                "latitude": float(row.get("latitude")) if row.get("latitude") else None,
                "longitude": float(row.get("longitude")) if row.get("longitude") else None,
            })

        return jsonify({"items": items, "count": len(items)}), 200

    except Exception as e:
        print(f"Error in get_realtime_sos: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": "Failed to fetch SOS alerts"}), 500
    finally:
        cursor.close()
