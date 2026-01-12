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

# Gender mapping
GENDER_MAP = {
    "M": "Male",
    "F": "Female"
}


@passenger_bp.route("/manifest", methods=["GET"])
def get_passenger_manifest():
    """
    Returns passenger manifest for boarded passengers only (bd.status = 'D')
    """

    origin_name = request.args.get("origin")
    destination_name = request.args.get("destination")
    departure_date = request.args.get("departure_date")
    departure_time = request.args.get("departure_time")

    print("\n=== MANIFEST FILTER DEBUG ===")
    print(f"Origin: {origin_name}")
    print(f"Destination: {destination_name}")
    print(f"Date: {departure_date}")
    print(f"Time: {departure_time}")

    cur = mysql.connection.cursor()

    try:
        where_clauses = ["bd.status = 'D'"]
        params = []

        # ---- Origin ----
        if origin_name:
            cur.execute(
                "SELECT Station_ID FROM Station WHERE StationName = %s",
                (origin_name,)
            )
            row = cur.fetchone()
            if row:
                where_clauses.append("bd.origin = %s")
                params.append(row[0])

        # ---- Destination ----
        if destination_name:
            cur.execute(
                "SELECT Station_ID FROM Station WHERE StationName = %s",
                (destination_name,)
            )
            row = cur.fetchone()
            if row:
                where_clauses.append("bd.destination = %s")
                params.append(row[0])

        # ---- Date ----
        if departure_date:
            where_clauses.append("bd.departure_date = %s")
            params.append(departure_date)

        # ---- Time (24-hour filter, display handled later) ----
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
            JOIN Users u
                ON u.User_ID = bd.User_ID
            LEFT JOIN Station so
                ON so.Station_ID = bd.origin
            LEFT JOIN Station sd
                ON sd.Station_ID = bd.destination
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

            # ---- Convert abbreviations ----
            gender_full = GENDER_MAP.get(gender, gender)
            platform_source_full = PLATFORM_SOURCE_MAP.get(
                platform_source, platform_source
            )

            # ---- Convert 24h time → 12h AM/PM ----
            formatted_time = None
            if dep_time:
                try:
                    # MySQL TIME / DATETIME
                    formatted_time = dep_time.strftime("%I:%M %p").lstrip("0")
                except AttributeError:
                    # timedelta
                    total_seconds = int(dep_time.total_seconds())
                    hours = total_seconds // 3600
                    minutes = (total_seconds % 3600) // 60

                    suffix = "AM" if hours < 12 else "PM"
                    hours = hours % 12
                    hours = 12 if hours == 0 else hours

                    formatted_time = f"{hours}:{minutes:02d} {suffix}"

            manifest.append({
                "full_name": full_name,
                "age": age,
                "gender": gender_full,
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
