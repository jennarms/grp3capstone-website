import threading
import time
from flask import Blueprint, request, jsonify, current_app
from app import mysql
from math import ceil
from datetime import datetime

# Initialize the Blueprint
boarding_passengertable_bp = Blueprint('boarding_passengertable_bp', __name__)

# =======================
# POLLING, INSERTION, AND STATUS UPDATE IN ONE FUNCTION
# =======================
def poll_for_new_bookings():
    while True:
        try:
            # Debugging output to check if polling is running
            print("Polling started...")  # Debugging output

            # Explicitly get app context here for background thread
            with current_app.app_context():  # Ensure app context is available in the background thread
                cursor = mysql.connection.cursor()  # Use mysql.connection here
                try:
                    # Step 1: Fetch bookings that are not yet inserted into BoardingDisembarking
                    cursor.execute("""
                    SELECT b.Booking_ID, b.User_ID, b.Qrcode_ID, b.Schedule_ID, b.origin, b.destination, b.departure_date, b.departure_time
                    FROM Booking b
                    LEFT JOIN BoardingDisembarking bd ON b.Booking_ID = bd.Booking_ID
                    WHERE bd.Booking_ID IS NULL  -- Only select bookings that haven't been inserted into BoardingDisembarking
                    """)
                    new_bookings = cursor.fetchall()
                    print(f"Fetched {len(new_bookings)} new bookings.")  # Debugging output

                    # Step 2: Insert each new booking into BoardingDisembarking with status 'P'
                    for booking in new_bookings:
                        schedule_id = booking[3] if booking[3] is not None else "NoSchedule"
                        
                        print(f"Inserting booking with Booking_ID: {booking[0]}")  # Debugging output

                        cursor.execute("""
                        INSERT INTO BoardingDisembarking (Booking_ID, User_ID, Qrcode_ID, Schedule_ID, origin, destination, departure_date, departure_time, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'P')
                        """, (booking[0], booking[1], booking[2], schedule_id, booking[4], booking[5], booking[6], booking[7]))

                        mysql.connection.commit()

                        print(f"Successfully inserted booking with Booking_ID: {booking[0]} into BoardingDisembarking.")  # Debugging output

                except Exception as e:
                    print(f"Error in database operations: {e}")
                finally:
                    cursor.close()

            print("Polling completed...")  # Debugging output
            time.sleep(10)  # Poll every 10 seconds

        except Exception as e:
            print(f"Error in polling loop: {e}")

# Start polling in a separate thread when app starts
def start_polling(app):
    # Pass app context to the thread when it starts
    print("Starting polling thread...")  # Debugging output
    poll_thread = threading.Thread(target=poll_for_new_bookings)  # Polling function runs in background thread
    poll_thread.daemon = True  # Ensure the thread stops when the app stops
    poll_thread.start()
    print("Polling thread started.")  # Debugging output


# Start the polling thread when Flask app is running
def run_polling_with_app_context(app):
    # Pass the Flask app instance to the polling function to use app context
    start_polling(app)

# =======================
# FETCHING OF BOARDINGDISEMBARKING TABLE
# =======================
def _get_station_id_by_name(station_name):
    cursor = mysql.connection.cursor()
    try:
        cursor.execute("SELECT Station_ID FROM Station WHERE StationName = %s", (station_name,))
        station_id = cursor.fetchone()
        if station_id:
            return station_id[0]
        else:
            return None
    except Exception as e:
        print(f"Error fetching station ID for {station_name}: {e}")
        return None
    finally:
        cursor.close()

@boarding_passengertable_bp.route('/get_boarding_details', methods=['GET'])
def get_boarding_details():
    origin_name = request.args.get('origin')
    schedule_time = request.args.get('schedule_time').strip()
    page = int(request.args.get('page', 1))
    query = request.args.get('query', '')

    if not origin_name or not schedule_time:
        return jsonify({'error': 'Origin (station_name) and schedule_time are required'}), 400

    # Fetch the station_id based on station name
    station_id = _get_station_id_by_name(origin_name)
    if not station_id:
        return jsonify({'error': 'Invalid station name'}), 400

    records_per_page = 10
    offset = (page - 1) * records_per_page

    try:
        count_query = """
        SELECT COUNT(*) 
        FROM BoardingDisembarking
        WHERE origin = %s
        AND TIME(departure_time) LIKE %s
        """

        cursor = mysql.connection.cursor()
        cursor.execute(count_query, (station_id, f"{schedule_time}%"))
        total_records = cursor.fetchone()[0]
        cursor.close()

        if total_records == 0:
            return jsonify({'boardingData': [], 'totalPages': 0, 'currentPage': page})

    except Exception as e:
        print(f"Error during count query: {e}")  # Debugging output
        return jsonify({'error': 'Database query failed'}), 500

    total_pages = ceil(total_records / records_per_page)

    try:
        search_query = """
        SELECT 
            bd.BD_ID, 
            bd.Booking_ID, 
            bd.User_ID, 
            bd.boarding_time, 
            bd.disembarking_time, 
            bd.status,
            bd.Qrcode_ID, 
            bd.Schedule_ID, 
            bd.origin, 
            bd.destination, 
            bd.departure_date, 
            bd.departure_time
        FROM BoardingDisembarking bd
        WHERE bd.origin = %s
        AND TIME(bd.departure_time) LIKE %s
        """

        if query:
            search_query += " AND (bd.Booking_ID LIKE %s OR bd.User_ID LIKE %s)"

        search_query += " ORDER BY bd.departure_date DESC, bd.departure_time DESC LIMIT %s OFFSET %s"

        cursor = mysql.connection.cursor()
        params = [station_id, f"{schedule_time}%"]
        if query:
            params.extend([f"%{query}%", f"%{query}%"])

        cursor.execute(search_query, params + [records_per_page, offset])
        passengers = cursor.fetchall()
        cursor.close()

        passenger_data = []
        for passenger in passengers:
            passenger_data.append({
                'BD_ID': passenger[0],
                'Booking_ID': passenger[1],
                'User_ID': passenger[2],
                'boarding_time': str(passenger[3]) if passenger[3] else "N/A",
                'disembarking_time': str(passenger[4]) if passenger[4] else "N/A",
                'status': passenger[5],
                'Qrcode_ID': passenger[6],
                'Schedule_ID': passenger[7],
                'origin': origin_name,
                'destination': passenger[9],
                'departure_date': passenger[10],
                'departure_time': str(passenger[11]) if passenger[11] else "N/A"
            })

    except Exception as e:
        print(f"Error during fetching passengers: {e}")  # Debugging output
        return jsonify({'error': 'Database query failed'}), 500

    return jsonify({
        'boardingData': passenger_data,
        'totalPages': total_pages,
        'currentPage': page
    })
