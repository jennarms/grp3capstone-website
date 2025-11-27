import time
from flask import Blueprint, request, jsonify
from app import mysql, scheduler
from math import ceil
from datetime import datetime
import traceback

# Initialize Blueprint
passengertable_bp = Blueprint('passengertable_bp', __name__)


# ======================================================
# APSCHEDULER POLLING TASK 
# ======================================================
def poll_new_bookings():
    print("[poll_new_bookings] Job started")

    # Ensure we are inside proper Flask app context
    with scheduler.app.app_context():
        cursor = mysql.connection.cursor()

        try:
            # --------------------------------------------------
            # 0) AUTO-CANCEL OLD PENDING BOOKINGS
            # --------------------------------------------------
            # Any record where departure_date < today AND status = 'P'
            # will be marked as 'C' (Cancelled).
            cursor.execute("""
                UPDATE BoardingDisembarking
                SET status = 'C'
                WHERE departure_date < CURDATE()
                  AND status = 'P'
            """)
            mysql.connection.commit()
            print("[poll_new_bookings] Auto-cancelled old pending bookings ✓")

            # --------------------------------------------------
            # 1) Fetch bookings not yet inside BoardingDisembarking
            # --------------------------------------------------
            cursor.execute("""
                SELECT 
                    b.Booking_ID,
                    b.User_ID,
                    b.Qrcode_ID,
                    b.Schedule_ID,
                    b.origin,
                    b.destination,
                    b.departure_date,
                    b.departure_time
                FROM Booking b
                WHERE NOT EXISTS (
                    SELECT 1 FROM BoardingDisembarking bd
                    WHERE bd.Booking_ID = b.Booking_ID
                )
            """)

            new_bookings = cursor.fetchall()
            print(f"[poll_new_bookings] Fetched {len(new_bookings)} bookings to insert")

            # 2) Insert each booking
            for booking in new_bookings:
                (booking_id, user_id, qrcode_id, schedule_id,
                 origin, destination, dep_date, dep_time) = booking

                # If QR code is missing, skip it
                if not qrcode_id:
                    print(f"[poll_new_bookings] SKIPPED {booking_id} — no Qrcode_ID")
                    continue

                print(f"[poll_new_bookings] Inserting Booking_ID={booking_id}")

                cursor.execute("""
                    INSERT INTO BoardingDisembarking 
                        (Booking_ID, User_ID, Qrcode_ID, Schedule_ID,
                         origin, destination, departure_date, departure_time, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'P')
                """, (
                    booking_id,
                    user_id,
                    qrcode_id,
                    schedule_id,      # MAY BE NULL — allowed now
                    origin,
                    destination,
                    dep_date,
                    dep_time
                ))

            mysql.connection.commit()
            print("[poll_new_bookings] Insert complete ✓")

        except Exception as e:
            mysql.connection.rollback()
            print("[poll_new_bookings] ERROR:", e)
            traceback.print_exc()

        finally:
            cursor.close()
            print("[poll_new_bookings] Job finished")


# ======================================================
# REGISTER POLLING TASK WITH APSCHEDULER
# ======================================================
def register_booking_polling():
    scheduler.add_job(
        id="poll_new_bookings",
        func=poll_new_bookings,
        trigger="interval",
        seconds=30,
        replace_existing=True
    )
    print("[register_booking_polling] Polling job registered")


# ======================================================
# HELPER: Get Station ID from Name
# ======================================================
def _get_station_id_by_name(station_name):
    cursor = mysql.connection.cursor()
    try:
        cursor.execute("SELECT Station_ID FROM Station WHERE StationName = %s", (station_name,))
        row = cursor.fetchone()
        return row[0] if row else None
    finally:
        cursor.close()


# ======================================================
# GET BOARDING DETAILS
# (unchanged logic)
# ======================================================
@passengertable_bp.route('/get_boarding_details', methods=['GET'])
def get_boarding_details():
    origin_name = request.args.get('origin')
    schedule_time = (request.args.get('schedule_time') or "").strip()
    page = int(request.args.get('page', 1))
    query = request.args.get('query', "")

    if not origin_name or not schedule_time:
        return jsonify({"error": "origin and schedule_time are required"}), 400

    station_id = _get_station_id_by_name(origin_name)
    if not station_id:
        return jsonify({"error": "Invalid station name"}), 400

    records_per_page = 10
    offset = (page - 1) * records_per_page

    # Count records
    cursor = mysql.connection.cursor()
    cursor.execute("""
        SELECT COUNT(*) 
        FROM BoardingDisembarking
        WHERE origin = %s AND TIME(departure_time) LIKE %s
    """, (station_id, f"{schedule_time}%"))

    total_records = cursor.fetchone()[0]
    cursor.close()

    if total_records == 0:
        return jsonify({"boardingData": [], "totalPages": 0, "currentPage": page})

    total_pages = ceil(total_records / records_per_page)

    cursor = mysql.connection.cursor()
    query_sql = """
        SELECT BD_ID, Booking_ID, User_ID, boarding_time, disembarking_time,
               status, Qrcode_ID, Schedule_ID, origin, destination,
               departure_date, departure_time
        FROM BoardingDisembarking
        WHERE origin = %s AND TIME(departure_time) LIKE %s
    """

    params = [station_id, f"{schedule_time}%"]

    if query:
        query_sql += " AND (Booking_ID LIKE %s OR User_ID LIKE %s)"
        params.extend([f"%{query}%", f"%{query}%"])

    query_sql += " ORDER BY departure_date DESC, departure_time DESC LIMIT %s OFFSET %s"
    params.extend([records_per_page, offset])

    cursor.execute(query_sql, params)
    rows = cursor.fetchall()
    cursor.close()

    results = []
    for r in rows:
        results.append({
            "BD_ID": r[0],
            "Booking_ID": r[1],
            "User_ID": r[2],
            "boarding_time": str(r[3]) if r[3] else "N/A",
            "disembarking_time": str(r[4]) if r[4] else "N/A",
            "status": r[5],
            "Qrcode_ID": r[6],
            "Schedule_ID": r[7],
            "origin": origin_name,
            "destination": r[9],
            "departure_date": r[10],
            "departure_time": str(r[11]) if r[11] else "N/A"
        })

    return jsonify({
        "boardingData": results,
        "totalPages": total_pages,
        "currentPage": page
    })


# ======================================================
# GET DISEMBARKING DETAILS
# (only today's B & D)
# ======================================================
@passengertable_bp.route('/get_disembarking_details', methods=['GET'])
def get_disembarking_details():
    destination_name = request.args.get('destination')
    page = int(request.args.get('page', 1))
    query = request.args.get('query', "")

    if not destination_name:
        return jsonify({"error": "destination is required"}), 400

    # 1) Resolve station ID from name coming from frontend ("PUP" -> "ST0004")
    station_id = _get_station_id_by_name(destination_name)
    if not station_id:
        return jsonify({"error": "Invalid station name"}), 400

    records_per_page = 10
    offset = (page - 1) * records_per_page

    cursor = mysql.connection.cursor()

    # ===========================================
    # STEP 1: find the latest departure_date that
    #         has rows for this destination
    # ===========================================
    cursor.execute(
        """
        SELECT MAX(departure_date)
        FROM BoardingDisembarking
        WHERE destination = %s
        """,
        (station_id,),
    )
    row = cursor.fetchone()
    latest_date = row[0] if row else None

    if not latest_date:
        cursor.close()
        return jsonify({
            "boardingData": [],
            "totalPages": 0,
            "currentPage": page
        })

    # ===========================================
    # STEP 2: build filters:
    #   - this destination
    #   - ONLY that latest_date
    #   - status B or D
    #   - optional search
    # ===========================================
    where_clauses = [
        "destination = %s",
        "departure_date = %s",
        "status IN ('B', 'D')",
    ]
    params = [station_id, latest_date]

    if query:
        where_clauses.append("(Booking_ID LIKE %s OR User_ID LIKE %s)")
        params.extend([f"%{query}%", f"%{query}%"])

    where_sql = " AND ".join(where_clauses)

    # ===========================================
    # STEP 3: count rows
    # ===========================================
    count_sql = f"""
        SELECT COUNT(*)
        FROM BoardingDisembarking
        WHERE {where_sql}
    """
    cursor.execute(count_sql, params)
    total_records = cursor.fetchone()[0]

    if total_records == 0:
        cursor.close()
        return jsonify({
            "boardingData": [],
            "totalPages": 0,
            "currentPage": page
        })

    total_pages = ceil(total_records / records_per_page)

    # ===========================================
    # STEP 4: fetch page data
    # ===========================================
    data_sql = f"""
        SELECT BD_ID, Booking_ID, User_ID, boarding_time, disembarking_time,
               status, Qrcode_ID, Schedule_ID, origin, destination,
               departure_date, departure_time
        FROM BoardingDisembarking
        WHERE {where_sql}
        ORDER BY departure_time DESC
        LIMIT %s OFFSET %s
    """

    data_params = list(params)
    data_params.extend([records_per_page, offset])

    cursor.execute(data_sql, data_params)
    rows = cursor.fetchall()
    cursor.close()

    results = []
    for r in rows:
        results.append({
            "BD_ID": r[0],
            "Booking_ID": r[1],
            "User_ID": r[2],
            "boarding_time": str(r[3]) if r[3] else "N/A",
            "disembarking_time": str(r[4]) if r[4] else "N/A",
            "status": r[5],
            "Qrcode_ID": r[6],
            "Schedule_ID": r[7],
            "origin": r[8],
            "destination": r[9],
            "departure_date": r[10],
            "departure_time": str(r[11]) if r[11] else "N/A"
        })

    return jsonify({
        "boardingData": results,
        "totalPages": total_pages,
        "currentPage": page
    })



# ======================================================
# UPDATE BOARDING / CANCEL / DISEMBARK
# ======================================================
@passengertable_bp.route('/update_passenger_status_and_qrcode', methods=['POST'])
def update_passenger_status_and_qrcode():
    data = request.get_json()
    bd_id = data.get('BD_ID')
    action = data.get('action')
    qrcode_id = data.get('Qrcode_ID')

    if not bd_id or not action or not qrcode_id:
        return jsonify({"error": "Missing required fields"}), 400

    cursor = mysql.connection.cursor()

    try:
        cursor.execute("SELECT status FROM BoardingDisembarking WHERE BD_ID = %s", (bd_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Passenger not found"}), 404

        current_status = row[0]

        if action == "accept":
            if current_status == "B":
                return jsonify({"error": "Already boarded"}), 400

            cursor.execute("""
                UPDATE BoardingDisembarking
                SET status='B', boarding_time=%s
                WHERE BD_ID=%s
            """, (datetime.now(), bd_id))

            cursor.execute("""
                UPDATE QRCode SET Maximum_Scan = Maximum_Scan - 1
                WHERE Qrcode_ID=%s
            """, (qrcode_id,))

        elif action == "cancel":
            if current_status == "B":
                return jsonify({"error": "Cannot cancel boarded passenger"}), 400

            cursor.execute("""
                UPDATE BoardingDisembarking
                SET status='C'
                WHERE BD_ID=%s
            """, (bd_id,))

            cursor.execute("""
                UPDATE QRCode SET ExpiresAt=%s, Maximum_Scan=0
                WHERE Qrcode_ID=%s
            """, (datetime.now(), qrcode_id))

        elif action == "disembark":
            if current_status != "B":
                return jsonify({"error": "Passenger must be boarded to disembark"}), 400

            cursor.execute("""
                UPDATE BoardingDisembarking
                SET status='D', disembarking_time=%s
                WHERE BD_ID=%s
            """, (datetime.now(), bd_id))

            cursor.execute("""
                UPDATE QRCode SET Maximum_Scan = Maximum_Scan - 1
                WHERE Qrcode_ID=%s
            """, (qrcode_id,))

        mysql.connection.commit()
        return jsonify({"message": "Status updated successfully"}), 200

    except Exception as e:
        mysql.connection.rollback()
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()
