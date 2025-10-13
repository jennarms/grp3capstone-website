import threading
import time
from flask import Blueprint, request, jsonify, current_app
from app import mysql
from math import ceil
from datetime import datetime
import traceback

# Initialize the Blueprint
passengertable_bp = Blueprint('bassengertable_bp', __name__)

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

@passengertable_bp.route('/get_boarding_details', methods=['GET'])
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

@passengertable_bp.route('/get_disembarking_details', methods=['GET'])
def get_disembarking_details():
    destination_name = request.args.get('destination')  # Get destination from the query parameters
    page = int(request.args.get('page', 1))  # Default to page 1 if not provided
    query = request.args.get('query', '')  # Optional query to search by Booking_ID or User_ID

    if not destination_name:
        return jsonify({'error': 'Destination (station_name) is required'}), 400

    # Fetch the station_id based on the destination name
    station_id = _get_station_id_by_name(destination_name)
    if not station_id:
        return jsonify({'error': 'Invalid station name'}), 400

    records_per_page = 10  # Limit results per page
    offset = (page - 1) * records_per_page  # Calculate offset for pagination

    try:
        # Count query to get the total number of passengers for the destination
        count_query = """
        SELECT COUNT(*) 
        FROM BoardingDisembarking
        WHERE destination = %s
          AND status = 'B'  # Only show boarded passengers
          AND departure_date >= CURDATE()  # Ensure passengers have a departure date of today or later
        """

        cursor = mysql.connection.cursor()
        cursor.execute(count_query, (destination_name,))
        total_records = cursor.fetchone()[0]
        cursor.close()

        # If no records found, return empty data
        if total_records == 0:
            return jsonify({'boardingData': [], 'totalPages': 0, 'currentPage': page})

    except Exception as e:
        print(f"Error during count query: {e}")
        return jsonify({'error': 'Database query failed'}), 500

    # Calculate total pages for pagination
    total_pages = ceil(total_records / records_per_page)

    try:
        # Fetch passenger details based on destination, status = 'B', and today's date
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
        WHERE bd.destination = %s
          AND bd.status = 'B'  # Only show boarded passengers
          AND bd.departure_date >= CURDATE()  # Ensure departure date is today or later
        """

        if query:
            search_query += " AND (bd.Booking_ID LIKE %s OR bd.User_ID LIKE %s)"  # Add search filter if query provided

        search_query += " ORDER BY bd.departure_date DESC, bd.departure_time DESC LIMIT %s OFFSET %s"  # Pagination

        cursor = mysql.connection.cursor()
        params = [destination_name]
        if query:
            params.extend([f"%{query}%", f"%{query}%"])

        cursor.execute(search_query, params + [records_per_page, offset])
        passengers = cursor.fetchall()
        cursor.close()

        # Format the fetched passenger data
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
                'origin': passenger[8],
                'destination': passenger[9],
                'departure_date': passenger[10],
                'departure_time': str(passenger[11]) if passenger[11] else "N/A"
            })

    except Exception as e:
        print(f"Error during fetching passengers: {e}")
        return jsonify({'error': 'Database query failed'}), 500

    # Return the data in the required structure
    return jsonify({
        'boardingData': passenger_data,
        'totalPages': total_pages,
        'currentPage': page
    })

# =======================
# UPDATE PASSENGER STATUS: ACCEPT (B) or CANCEL (C)
# =======================

@passengertable_bp.route('/update_passenger_status_and_qrcode', methods=['POST'])
def update_passenger_status_and_qrcode():
    data = request.get_json()
    bd_id = data.get('BD_ID')
    action = data.get('action')  # 'accept' or 'cancel'
    qrcode_id = data.get('Qrcode_ID')

    cursor = mysql.connection.cursor()

    try:
        if not bd_id or not action or not qrcode_id:
            return jsonify({"error": "BD_ID, action, and Qrcode_ID are required"}), 400

        # Get the current status of the passenger
        cursor.execute("""
            SELECT status FROM BoardingDisembarking WHERE BD_ID = %s
        """, (bd_id,))
        bd = cursor.fetchone()

        if not bd:
            return jsonify({"error": "Passenger not found"}), 404

        current_status = bd[0]

        # Handle 'accept' action (boarding)
        if action == 'accept':
            if current_status == 'B':  # If the status is already 'B', prevent boarding again
                return jsonify({"error": "Passenger is already boarded"}), 400
            status = 'B'  # Set status to 'B' (boarded)
            boarding_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')  # Get current timestamp

            # Update BoardingDisembarking
            cursor.execute("""
                UPDATE BoardingDisembarking
                SET status = %s, boarding_time = %s
                WHERE BD_ID = %s
            """, (status, boarding_time, bd_id))

        # Handle 'cancel' action (cancellation)
        elif action == 'cancel':
            if current_status == 'B':  # If the status is 'B' (boarded), prevent cancellation
                return jsonify({"error": "You cannot cancel boarded passengers"}), 400
            status = 'C'  # Set status to 'C' (cancelled)

            # Update BoardingDisembarking
            cursor.execute("""
                UPDATE BoardingDisembarking
                SET status = %s
                WHERE BD_ID = %s
            """, (status, bd_id))

        # Update QRCode based on action
        if action == 'cancel':
            # If cancel, set ExpiresAt and reset Maximum_Scan
            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            cursor.execute("""
                UPDATE QRCode
                SET ExpiresAt = %s, Maximum_Scan = 0
                WHERE Qrcode_ID = %s
            """, (now, qrcode_id))
        else:  # accept
            # If accept, decrease the Maximum_Scan
            cursor.execute("""
                UPDATE QRCode
                SET Maximum_Scan = Maximum_Scan - 1
                WHERE Qrcode_ID = %s
            """, (qrcode_id,))

        # Commit changes to the database
        mysql.connection.commit()

        return jsonify({"message": "Passenger status and QR Code updated successfully"}), 200

    except Exception as e:
        mysql.connection.rollback()
        print("=== Exception in update_passenger_status_and_qrcode ===")
        traceback.print_exc()  # This prints the full stack trace in console
        return jsonify({"error": str(e)}), 500

    finally:
        cursor.close()