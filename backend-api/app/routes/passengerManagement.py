from flask import Blueprint, jsonify, request
from app import mysql

passenger_bp = Blueprint("passenger_bp", __name__)

# Platform source mapping
PLATFORM_SOURCE_MAP = {
    "MA": "Mobile Application",
    "MB": "Manual Booking",
    "EM": "Email",
    "CB": "Chatbot"
}

# ✅ Gender mapping
GENDER_MAP = {
    "M": "Male",
    "F": "Female"
}

@passenger_bp.route("/manifest", methods=["GET"])
def get_passenger_manifest():
    """
    Returns passenger manifest for boarded passengers (status = 'D')
    """
    origin_name = request.args.get("origin", None)
    destination_name = request.args.get("destination", None)
    departure_date = request.args.get("departure_date", None)
    departure_time = request.args.get("departure_time", None)

    print(f"\n=== MANIFEST FILTER DEBUG ===")
    print(f"Origin: {origin_name}")
    print(f"Destination: {destination_name}")
    print(f"Date: {departure_date}")
    print(f"Time: {departure_time}")

    cur = mysql.connection.cursor()
    try:
        where_clauses = ["bd.status = 'D'"]
        params = []

        if origin_name:
            cur.execute(
                "SELECT Station_ID FROM Station WHERE StationName = %s",
                (origin_name,)
            )
            row = cur.fetchone()
            if row:
                where_clauses.append("bd.origin = %s")
                params.append(row[0])

        if destination_name:
            cur.execute(
                "SELECT Station_ID FROM Station WHERE StationName = %s",
                (destination_name,)
            )
            row = cur.fetchone()
            if row:
                where_clauses.append("bd.destination = %s")
                params.append(row[0])

        if departure_date:
            where_clauses.append("bd.departure_date = %s")
            params.append(departure_date)

        if departure_time:
            where_clauses.append("bd.departure_time = %s")
            params.append(departure_time)

        where_sql = "WHERE " + " AND ".join(where_clauses)

        sql = f"""
            SELECT
                u.first_name,
                u.last_name,
                u.age,
                u.gender,
                u.contact_number,
                u.address,
                u.profession,
                u.platform_source,
                bd.departure_date,
                bd.departure_time,
                so.StationName AS origin_name,
                sd.StationName AS destination_name
            FROM BoardingDisembarking bd
            JOIN Users u ON u.User_ID = bd.User_ID
            LEFT JOIN Station so ON so.Station_ID = bd.origin
            LEFT JOIN Station sd ON sd.Station_ID = bd.destination
            {where_sql}
            ORDER BY u.last_name, u.first_name;
        """

        cur.execute(sql, tuple(params))
        rows = cur.fetchall()

        manifest = []

        for row in rows:
            (
                first_name,
                last_name,
                age,
                gender,
                contact_number,
                address,
                profession,
                platform_source,
                dep_date,
                dep_time,
                origin_name,
                destination_name,
            ) = row

            full_name = f"{first_name or ''} {last_name or ''}".strip()

            # Convert abbreviations
            gender_full = GENDER_MAP.get(gender, gender)
            platform_source_full = PLATFORM_SOURCE_MAP.get(platform_source, platform_source)

            # Format time safely
            formatted_time = None
            if dep_time:
                if hasattr(dep_time, "strftime"):
                    formatted_time = dep_time.strftime("%H:%M:%S")
                else:
                    total_seconds = int(dep_time.total_seconds())
                    formatted_time = f"{total_seconds // 3600:02d}:{(total_seconds % 3600) // 60:02d}:{total_seconds % 60:02d}"

            manifest.append({
                "full_name": full_name,
                "age": age,
                "gender": gender_full,  # ✅ Male / Female
                "contact_number": contact_number,
                "address": address,
                "profession": profession,
                "platform_source": platform_source_full,
                "departure_date": dep_date.isoformat() if dep_date else None,
                "departure_time": formatted_time,
                "origin_name": origin_name,
                "destination_name": destination_name,
            })

        return jsonify(manifest), 200

    except Exception as e:
        print(f"ERROR in get_passenger_manifest: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    finally:
        cur.close()
