from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import mysql
from datetime import datetime

sos_bp = Blueprint("sos", __name__)

# =========================
# Helpers
# =========================

STATUS_DB_TO_UI = {
    "PN": "New",         # Pending / new
    "RS": "Responding",
    "RV": "Resolved",
}

STATUS_UI_TO_DB = {v: k for k, v in STATUS_DB_TO_UI.items()}


def format_time(dt):
    """Format datetime or ISO string to 'H:MM AM/PM'."""
    if not dt:
        return None
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt)
        except Exception:
            return dt
    return dt.strftime("%I:%M %p").lstrip("0")


def dictfetchall(cursor):
    cols = [col[0] for col in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


def dictfetchone(cursor):
    row = cursor.fetchone()
    if row is None:
        return None
    cols = [col[0] for col in cursor.description]
    return dict(zip(cols, row))


def build_trip_route(origin, destination):
    if origin and destination:
        return f"{origin} \u2192 {destination}"
    elif origin:
        return origin
    elif destination:
        return destination
    return "Route not set"


def get_station_id_from_token():
    try:
        identity = get_jwt_identity()
        print(f"[DEBUG] JWT Identity: {identity}, Type: {type(identity)}")
        
        if not identity:
            return None, None

        role = None
        station_id = None

        if isinstance(identity, dict):
            role = identity.get("role")
            station_id = identity.get("station_id") or identity.get("Station_ID")
        elif isinstance(identity, str):
            station_id = identity

        return role, station_id
    except Exception as e:
        print(f"[ERROR] Error extracting station_id from token: {e}")
        import traceback
        traceback.print_exc()
        return None, None


def build_station_item(row):
    """Build a single SOS item for station view (StationSOS page)."""
    first = row.get("first_name") or ""
    last = row.get("last_name") or ""
    passenger_name = f"{first} {last}".strip() or row.get("User_ID") or "Unknown Rider"

    return {
        "id": row.get("SOS_ID"),
        "name": passenger_name,
        "time": format_time(row.get("timestamp")),
        "boardingStation": row.get("StationName") or "Unknown Station",
        "route": build_trip_route(row.get("origin"), row.get("destination")),
        "status": STATUS_DB_TO_UI.get(row.get("status") or "PN", "New"),
        "respondingAt": format_time(row.get("responding_at")),
        "resolvedAt": format_time(row.get("resolved_at")),
    }

# =========================
# Routes
# =========================

@sos_bp.route("/station", methods=["GET"])
@jwt_required()
def get_station_sos():
    role, station_id = get_station_id_from_token()
    if station_id is None:
        return jsonify({"message": "Unauthorized \u2013 station account required"}), 403

    cursor = mysql.connection.cursor()
    try:
        cursor.execute(
            """
            SELECT s.SOS_ID,
                   s.User_ID,
                   s.Station_ID,
                   s.timestamp,
                   s.status,
                   s.responding_at,
                   s.resolved_at,
                   st.StationName,
                   u.first_name,
                   u.last_name,
                   b.origin,
                   b.destination
            FROM SOS s
            LEFT JOIN Station st ON st.Station_ID = s.Station_ID
            LEFT JOIN Users u ON u.User_ID = s.User_ID
            LEFT JOIN Booking b ON b.User_ID = s.User_ID 
                AND DATE(b.departure_date) = DATE(s.timestamp)
            WHERE s.Station_ID = %s
            ORDER BY s.timestamp DESC
            """,
            (station_id,),
        )
        rows = dictfetchall(cursor)

        items = [build_station_item(row) for row in rows]

        return jsonify({"items": items}), 200
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"message": f"Database error: {str(e)}"}), 500
    finally:
        cursor.close()


@sos_bp.route("/station/<sos_id>/respond", methods=["PATCH"])
@jwt_required()
def mark_sos_responding(sos_id):
    role, station_id = get_station_id_from_token()
    if station_id is None:
        return jsonify({"message": "Unauthorized \u2013 station account required"}), 403

    cursor = mysql.connection.cursor()
    try:
        cursor.execute(
            "SELECT status FROM SOS WHERE SOS_ID = %s AND Station_ID = %s",
            (sos_id, station_id),
        )
        row = dictfetchone(cursor)
        if not row:
            return jsonify({"message": "SOS not found for this station"}), 404
        if row["status"] != "PN":
            return jsonify({"message": "Only New SOS can be marked as Responding"}), 400

        now = datetime.now()
        # Try to store responding_at; if fails, at least update status
        try:
            cursor.execute(
                "UPDATE SOS SET status = %s, responding_at = %s WHERE SOS_ID = %s AND Station_ID = %s",
                ("RS", now, sos_id, station_id),
            )
        except Exception:
            cursor.execute(
                "UPDATE SOS SET status = %s WHERE SOS_ID = %s AND Station_ID = %s",
                ("RS", sos_id, station_id),
            )
        mysql.connection.commit()

        # Fetch updated row for frontend
        cursor.execute(
            """
            SELECT s.SOS_ID,
                   s.User_ID,
                   s.Station_ID,
                   s.timestamp,
                   s.status,
                   s.responding_at,
                   s.resolved_at,
                   st.StationName,
                   u.first_name,
                   u.last_name,
                   b.origin,
                   b.destination
            FROM SOS s
            LEFT JOIN Station st ON st.Station_ID = s.Station_ID
            LEFT JOIN Users u ON u.User_ID = s.User_ID
            LEFT JOIN Booking b ON b.User_ID = s.User_ID 
                AND DATE(b.departure_date) = DATE(s.timestamp)
            WHERE s.SOS_ID = %s AND s.Station_ID = %s
            """,
            (sos_id, station_id),
        )
        updated_row = dictfetchone(cursor)
        item = build_station_item(updated_row) if updated_row else None

        return jsonify({"message": "SOS marked as Responding", "item": item}), 200
    except Exception as e:
        import traceback; traceback.print_exc()
        mysql.connection.rollback()
        return jsonify({"message": "Failed to update SOS"}), 500
    finally:
        cursor.close()


@sos_bp.route("/station/<sos_id>/resolve", methods=["PATCH"])
@jwt_required()
def mark_sos_resolved(sos_id):
    role, station_id = get_station_id_from_token()
    if station_id is None:
        return jsonify({"message": "Unauthorized \u2013 station account required"}), 403

    cursor = mysql.connection.cursor()
    try:
        cursor.execute(
            "SELECT status FROM SOS WHERE SOS_ID = %s AND Station_ID = %s",
            (sos_id, station_id),
        )
        row = dictfetchone(cursor)
        if not row:
            return jsonify({"message": "SOS not found for this station"}), 404
        if row["status"] != "RS":
            return jsonify({"message": "Only Responding SOS can be marked as Resolved"}), 400

        now = datetime.now()
        # Try to store resolved_at; if fails, at least update status
        try:
            cursor.execute(
                "UPDATE SOS SET status = %s, resolved_at = %s WHERE SOS_ID = %s AND Station_ID = %s",
                ("RV", now, sos_id, station_id),
            )
        except Exception:
            cursor.execute(
                "UPDATE SOS SET status = %s WHERE SOS_ID = %s AND Station_ID = %s",
                ("RV", sos_id, station_id),
            )
        mysql.connection.commit()

        # Fetch updated row for frontend
        cursor.execute(
            """
            SELECT s.SOS_ID,
                   s.User_ID,
                   s.Station_ID,
                   s.timestamp,
                   s.status,
                   s.responding_at,
                   s.resolved_at,
                   st.StationName,
                   u.first_name,
                   u.last_name,
                   b.origin,
                   b.destination
            FROM SOS s
            LEFT JOIN Station st ON st.Station_ID = s.Station_ID
            LEFT JOIN Users u ON u.User_ID = s.User_ID
            LEFT JOIN Booking b ON b.User_ID = s.User_ID 
                AND DATE(b.departure_date) = DATE(s.timestamp)
            WHERE s.SOS_ID = %s AND s.Station_ID = %s
            """,
            (sos_id, station_id),
        )
        updated_row = dictfetchone(cursor)
        item = build_station_item(updated_row) if updated_row else None

        return jsonify({"message": "SOS marked as Resolved", "item": item}), 200
    except Exception as e:
        import traceback; traceback.print_exc()
        mysql.connection.rollback()
        return jsonify({"message": "Failed to update SOS"}), 500
    finally:
        cursor.close()


# =========================
# New safer status route for useSOS.js polling
# =========================
@sos_bp.route("", methods=["GET"])
@jwt_required()
def get_sos_by_status():
    """
    GET /api/sos?status=OPEN
    Returns SOS entries filtered by status.
    Safe for nulls in Users, Station, Booking, latitude, longitude.
    """
    try:
        status_param = request.args.get('status', '').upper()
        print(f"[DEBUG] GET /api/sos with status={status_param}")

        # Map frontend status to database status
        status_map = {
            'OPEN': 'PN',        # New / Pending
            'NEW': 'PN',
            'RESPONDING': 'RS',
            'RESOLVED': 'RV'
        }
        db_status = status_map.get(status_param)
        if not db_status:
            return jsonify({"message": "Invalid status parameter"}), 400

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
                    s.responding_at,
                    s.resolved_at,
                    st.StationName,
                    u.first_name,
                    u.last_name,
                    b.origin,
                    b.destination
                FROM SOS s
                LEFT JOIN Station st ON st.Station_ID = s.Station_ID
                LEFT JOIN Users u ON u.User_ID = s.User_ID
                LEFT JOIN Booking b 
                    ON b.User_ID = s.User_ID 
                    AND DATE(b.departure_date) = DATE(s.timestamp)
                WHERE s.status = %s
                ORDER BY s.timestamp DESC
                """,
                (db_status,),
            )

            rows = dictfetchall(cursor)
            print(f"[DEBUG] Found {len(rows)} SOS records with status {status_param}")

            items = []
            for row in rows:
                # Safe passenger name
                first = row.get("first_name") or ""
                last = row.get("last_name") or ""
                passenger_name = f"{first} {last}".strip() or row.get("User_ID") or "Unknown Rider"

                # Safe boarding station
                boarding_station = row.get("StationName") or "Unknown Station"

                # Safe latitude/longitude
                lat = row.get("latitude")
                lon = row.get("longitude")
                try:
                    lat = float(lat) if lat is not None else None
                    lon = float(lon) if lon is not None else None
                except Exception:
                    lat, lon = None, None

                trip_route = build_trip_route(row.get("origin"), row.get("destination"))
                ui_status = STATUS_DB_TO_UI.get(row.get("status") or "PN", "New")

                items.append({
                    "id": row.get("SOS_ID"),
                    "userId": row.get("User_ID"),
                    "name": passenger_name,
                    "time": format_time(row.get("timestamp")),
                    "boardingStation": boarding_station,
                    "route": trip_route,
                    "status": ui_status,
                    "latitude": lat,
                    "longitude": lon,
                    "respondingAt": format_time(row.get("responding_at")),
                    "resolvedAt": format_time(row.get("resolved_at")),
                })

            return jsonify({"items": items, "count": len(items)}), 200

        except Exception as e:
            print("ERROR in database query:", e)
            import traceback
            traceback.print_exc()
            return jsonify({"message": f"Database error: {str(e)}"}), 500
        finally:
            cursor.close()

    except Exception as e:
        print("ERROR in get_sos_by_status:", e)
        import traceback
        traceback.print_exc()
        return jsonify({"message": f"Server error: {str(e)}"}), 500
