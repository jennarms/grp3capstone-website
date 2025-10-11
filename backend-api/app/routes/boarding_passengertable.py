from flask import Blueprint, request, jsonify, current_app
from app import mysql  # Assuming mysql connection setup is imported here
from math import ceil  # For calculating totalPages
from datetime import datetime
from flask_apscheduler import APScheduler  # For background task scheduling

# Initialize the Blueprint
boarding_passengertable_bp = Blueprint('boarding_passengertable_bp', __name__)

# Polling function to check for new bookings and insert into BoardingDisembarking
def poll_new_bookings():
    with current_app.app_context():
        cursor = mysql.connection.cursor()
        query = """
            SELECT Booking_ID, User_ID, Qrcode_ID, origin, destination, departure_date, departure_time, Schedule_ID
            FROM Booking
            WHERE Booking_ID NOT IN (SELECT Booking_ID FROM BoardingDisembarking)
        """
        
        cursor.execute(query)
        new_bookings = cursor.fetchall()
        
        # Insert each new booking into BoardingDisembarking with status 'P'
        for booking in new_bookings:
            booking_id, user_id, qrcode_id, origin, destination, departure_date, departure_time, schedule_id = booking
            
            insert_query = """
                INSERT INTO BoardingDisembarking 
                (BD_ID, Booking_ID, User_ID, boarding_time, disembarking_time, status, Qrcode_ID, Schedule_ID, origin, destination, departure_date, departure_time)
                VALUES (%s, %s, %s, %s, %s, 'P', %s, %s, %s, %s, %s, %s)
            """
            
            bd_id = str(datetime.now().timestamp())  # Generating BD_ID based on timestamp
            
            cursor.execute(insert_query, (
                bd_id, booking_id, user_id, None, None, qrcode_id, schedule_id, origin, destination, departure_date, departure_time
            ))
            mysql.connection.commit()
        
        cursor.close()

def _get_station_id_by_name(station_name):
    """Return the station ID from the Station table based on the station_name."""
    print(f"Looking for station: {station_name}")  # Log the station name being searched for
    cursor = mysql.connection.cursor()
    cursor.execute("SELECT Station_ID FROM Station WHERE StationName = %s", (station_name,))
    station_id = cursor.fetchone()
    cursor.close()
    if station_id:
        return station_id[0]
    else:
        # Log the error to help identify what's going wrong
        print(f"Station '{station_name}' not found in the database.")
        return None


# Route to fetch passenger data based on origin and schedule
@boarding_passengertable_bp.route('/get_boarding_details', methods=['GET'])
def get_boarding_details():
    # Get origin (station_name), schedule_time, and page from query parameters
    origin_name = request.args.get('origin')  # Station name passed from frontend
    schedule_time = request.args.get('schedule_time')  # Example: '08:05'
    page = int(request.args.get('page', 1))  # Default to page 1 if no page is passed

    # Debug: Log incoming parameters
    print(f"Received params - Origin: {origin_name}, Schedule Time: {schedule_time}, Page: {page}")

    if not origin_name or not schedule_time:
        return jsonify({'error': 'Origin (station_name) and schedule_time are required'}), 400

    # Fetch the station_id based on station name
    station_id = _get_station_id_by_name(origin_name)
    if not station_id:
        return jsonify({'error': 'Invalid station name'}), 400

    # Debug: Log station_id fetched
    print(f"Station ID: {station_id}")

    # Number of records per page
    records_per_page = 10
    offset = (page - 1) * records_per_page  # Calculate the offset based on page number

    try:
         # MySQL query to fetch the total count of records matching the station_id and schedule_time
        count_query = """
            SELECT COUNT(*) FROM BoardingDisembarking
            WHERE origin = %s
            AND departure_time LIKE %s
        """
        
        print(f"Executing count query: {count_query} with params: {(station_id, f'{schedule_time}%')}")
        cursor = mysql.connection.cursor()
        cursor.execute(count_query, (station_id, f"{schedule_time}%"))
        total_records = cursor.fetchone()[0]  # Get the total number of records
        cursor.close()

    except Exception as e:
        # Log the error for debugging
        print(f"Error executing count query: {e}")
        return jsonify({'error': 'Database query failed'}), 500

    # Calculate total pages
    total_pages = ceil(total_records / records_per_page)

    try:
        # Query to fetch all passenger data with pagination (limit and offset), including past bookings
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
                bd.departure_time, 
                b.payment_status, 
                b.payment_amount, 
                b.paid_at, 
                b.booking_source
            FROM BoardingDisembarking bd
            LEFT JOIN Booking b ON bd.Booking_ID = b.Booking_ID
            WHERE bd.origin = %s
              AND bd.departure_time LIKE %s
            ORDER BY b.departure_date DESC, b.departure_time DESC
            LIMIT %s OFFSET %s  -- Pagination added here
        """

        print(f"Executing search query: {search_query} with params: {(station_id, f'{schedule_time}%', records_per_page, offset)}")
        cursor = mysql.connection.cursor()
        params = [station_id, f"{schedule_time}%"]  # Main search query parameters

        # Execute query with parameters for pagination
        cursor.execute(search_query, params + [records_per_page, offset])  # Execute query with parameters for pagination

        # Fetch the results as a list of dictionaries
        passengers = cursor.fetchall()

        # Convert the results to a list of dictionaries
        passenger_data = []
        for passenger in passengers:
            passenger_data.append({
                'BD_ID': passenger[0],
                'Booking_ID': passenger[1],
                'User_ID': passenger[2],
                'boarding_time': passenger[3],
                'disembarking_time': passenger[4],
                'status': passenger[5],
                'Qrcode_ID': passenger[6],
                'Schedule_ID': passenger[7],
                'origin': origin_name,  # Use the station name instead of the station ID
                'destination': passenger[9],
                'departure_date': passenger[10],
                'departure_time': passenger[11],
                'payment_status': passenger[12],
                'payment_amount': passenger[13],
                'paid_at': passenger[14],
                'booking_source': passenger[15]
            })

        cursor.close()

    except Exception as e:
        # Log the error for debugging
        print(f"Error executing search query: {e}")
        return jsonify({'error': 'Database query failed'}), 500

    # Return the passenger data in JSON format along with pagination info
    return jsonify({
        'boardingData': passenger_data,
        'totalPages': total_pages,  # Pass the total number of pages for pagination
        'currentPage': page
    })
