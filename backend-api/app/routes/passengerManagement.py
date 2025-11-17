# passengerManagement.py
from flask import Blueprint, jsonify, request
from app import mysql

passenger_bp = Blueprint("passenger_bp", __name__)

@passenger_bp.route("/manifest", methods=["GET"])
def get_passenger_manifest():
    """
    Returns passenger manifest for a specific trip (or filtered trips),
    based on BoardingDisembarking records where status = 'D'
    (i.e., passengers who actually boarded).
    Filters (all optional, but usually provided together):
      - origin: StationName of origin
      - destination: StationName of destination
      - departure_date: YYYY-MM-DD
      - departure_time: HH:MM:SS (or HH:MM)
    """
    origin_name = request.args.get("origin", None)
    destination_name = request.args.get("destination", None)
    departure_date = request.args.get("departure_date", None)
    departure_time = request.args.get("departure_time", None)

    print(f"\n=== MANIFEST FILTER DEBUG ===")
    print(f"Received origin_name: '{origin_name}'")
    print(f"Received destination_name: '{destination_name}'")
    print(f"Received departure_date: '{departure_date}'")
    print(f"Received departure_time: '{departure_time}'")

    cur = mysql.connection.cursor()
    try:
        # Start with base condition
        where_clauses = ["bd.status = 'D'"]
        params = []

        # Convert station names to station IDs
        if origin_name:
            cur.execute("SELECT Station_ID FROM Station WHERE StationName = %s", (origin_name,))
            origin_row = cur.fetchone()
            print(f"Origin lookup for '{origin_name}': {origin_row}")
            if origin_row:
                origin_id = origin_row[0]
                where_clauses.append("bd.origin = %s")
                params.append(origin_id)
                print(f"Added origin filter: bd.origin = '{origin_id}'")
            else:
                print(f"WARNING: No station found with name '{origin_name}'")
        
        if destination_name:
            cur.execute("SELECT Station_ID FROM Station WHERE StationName = %s", (destination_name,))
            dest_row = cur.fetchone()
            print(f"Destination lookup for '{destination_name}': {dest_row}")
            if dest_row:
                destination_id = dest_row[0]
                where_clauses.append("bd.destination = %s")
                params.append(destination_id)
                print(f"Added destination filter: bd.destination = '{destination_id}'")
            else:
                print(f"WARNING: No station found with name '{destination_name}'")
        
        if departure_date:
            where_clauses.append("bd.departure_date = %s")
            params.append(departure_date)
            print(f"Added date filter: bd.departure_date = '{departure_date}'")
        
        if departure_time:
            where_clauses.append("bd.departure_time = %s")
            params.append(departure_time)
            print(f"Added time filter: bd.departure_time = '{departure_time}'")

        where_sql = "WHERE " + " AND ".join(where_clauses)
        
        print(f"\nFinal WHERE clauses: {where_clauses}")
        print(f"Final params: {params}")

        sql = f"""
            SELECT 
                u.User_ID,
                u.first_name,
                u.last_name,
                u.age,
                u.gender,
                u.contact_number,
                u.address,
                u.profession,
                u.platform_source,
                bd.Booking_ID,
                bd.Schedule_ID,
                bd.departure_date,
                bd.departure_time,
                bd.origin,
                so.StationName AS origin_name,
                bd.destination,
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
        
        print(f"\nExecuting query...")
        print(f"Params tuple: {tuple(params)}")
        
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
        
        print(f"Query returned {len(rows)} rows")
        
        # Debug: Show first few rows from BoardingDisembarking to verify data
        if len(rows) == 0:
            print("\n=== DEBUGGING: Checking BoardingDisembarking table ===")
            cur.execute("""
                SELECT bd.origin, bd.destination, bd.departure_date, bd.departure_time, bd.status,
                       so.StationName as origin_name, sd.StationName as dest_name
                FROM BoardingDisembarking bd
                LEFT JOIN Station so ON so.Station_ID = bd.origin
                LEFT JOIN Station sd ON sd.Station_ID = bd.destination
                WHERE bd.status = 'D'
                LIMIT 5
            """)
            debug_rows = cur.fetchall()
            print(f"Sample BoardingDisembarking records (status='D'):")
            for dr in debug_rows:
                print(f"  Origin: {dr[0]} ({dr[5]}), Dest: {dr[1]} ({dr[6]}), Date: {dr[2]}, Time: {dr[3]}")

        manifest = []
        for row in rows:
            (
                user_id,
                first_name,
                last_name,
                age,
                gender,
                contact_number,
                address,
                profession,
                platform_source,
                booking_id,
                schedule_id,
                dep_date,
                dep_time,
                origin_id,
                origin_name,
                dest_id,
                dest_name,
            ) = row

            full_name = f"{first_name or ''} {last_name or ''}".strip()

            # Handle departure_time - can be either time or timedelta
            formatted_time = None
            if dep_time:
                if hasattr(dep_time, 'strftime'):
                    # It's a time object
                    formatted_time = dep_time.strftime("%H:%M:%S")
                else:
                    # It's a timedelta object
                    total_seconds = int(dep_time.total_seconds())
                    hours = total_seconds // 3600
                    minutes = (total_seconds % 3600) // 60
                    seconds = total_seconds % 60
                    formatted_time = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            
            manifest.append({
                "User_ID": user_id,
                "first_name": first_name,
                "last_name": last_name,
                "full_name": full_name,
                "age": age,
                "gender": gender,
                "contact_number": contact_number,
                "address": address,
                "profession": profession,
                "platform_source": platform_source,
                "Booking_ID": booking_id,
                "Schedule_ID": schedule_id,
                "departure_date": dep_date.isoformat() if dep_date else None,
                "departure_time": formatted_time,
                "origin_id": origin_id,
                "origin_name": origin_name,
                "destination_id": dest_id,
                "destination_name": dest_name,
            })

        print(f"=== END DEBUG ===\n")
        return jsonify(manifest), 200
        
    except Exception as e:
        print(f"ERROR in get_passenger_manifest: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()