from flask import Blueprint, request, jsonify
from app import mysql
from math import ceil
from datetime import datetime

# Initialize the Blueprint
boarding_passengertable_bp = Blueprint('boarding_passengertable_bp', __name__)

# Helper function to get station_id by station_name
def _get_station_id_by_name(station_name):
    """Return the station ID from the Station table based on the station_name."""
    cursor = mysql.connection.cursor()
    try:
        cursor.execute("SELECT Station_ID FROM Station WHERE StationName = %s", (station_name,))
        station_id = cursor.fetchone()
        if station_id:
            print(f"Station '{station_name}' found with ID: {station_id[0]}")  # Debugging station ID
            return station_id[0]
        else:
            print(f"Station '{station_name}' not found in the database.")  # Debugging
            return None
    except Exception as e:
        print(f"Error fetching station ID for {station_name}: {e}")
        return None
    finally:
        cursor.close()

# Route to fetch passenger data based on origin and schedule
@boarding_passengertable_bp.route('/get_boarding_details', methods=['GET'])
def get_boarding_details():
    # Get origin (station_name), schedule_time, and page from query parameters
    origin_name = request.args.get('origin')  # Station name passed from frontend
    schedule_time = request.args.get('schedule_time').strip()  # Strip any unwanted whitespace or newline characters
    page = int(request.args.get('page', 1))  # Default to page 1 if no page is passed
    query = request.args.get('query', '')  # Optional query for searching

    # Debug: Log incoming parameters
    print(f"Received params - Origin: {origin_name}, Schedule Time: {schedule_time}, Page: {page}")

    if not origin_name or not schedule_time:
        return jsonify({'error': 'Origin (station_name) and schedule_time are required'}), 400

    # Fetch the station_id based on station name (origin_name)
    station_id = _get_station_id_by_name(origin_name)
    if not station_id:
        return jsonify({'error': 'Invalid station name'}), 400

    print(f"Station ID: {station_id}")

    # Number of records per page
    records_per_page = 10
    offset = (page - 1) * records_per_page  # Calculate the offset based on page number

    try:
        # MySQL query to fetch the total count of records matching the station_id and schedule_time
        count_query = """
        SELECT COUNT(*) 
        FROM BoardingDisembarking
        WHERE origin = %s
        AND TIME(departure_time) LIKE %s
    """

        cursor = mysql.connection.cursor()
        print(f"Executing count query with parameters: {station_id}, {f'{schedule_time}%'}")  # Debugging
        cursor.execute(count_query, (station_id, f"{schedule_time}%"))
        total_records = cursor.fetchone()[0]  # Get the total number of records
        print(f"Total records matching the criteria: {total_records}")  # Debugging
        cursor.close()

        if total_records == 0:
            return jsonify({'boardingData': [], 'totalPages': 0, 'currentPage': page})

    except Exception as e:
        print(f"Error executing count query: {e}")
        return jsonify({'error': 'Database query failed'}), 500

    # Calculate total pages
    total_pages = ceil(total_records / records_per_page)

    try:
        # Query to fetch all passenger data with pagination (limit and offset)
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

        # If query is not empty, add conditions to search by query (for matching fields like Booking_ID, User_ID)
        if query:
            search_query += " AND (bd.Booking_ID LIKE %s OR bd.User_ID LIKE %s)"

        search_query += " ORDER BY bd.departure_date DESC, bd.departure_time DESC LIMIT %s OFFSET %s"

        cursor = mysql.connection.cursor()
        params = [station_id, f"{schedule_time}%"]

        if query:
            params.extend([f"%{query}%", f"%{query}%"])

        print(f"Executing search query with parameters: {params + [records_per_page, offset]}")  # Debugging

        cursor.execute(search_query, params + [records_per_page, offset])  # Execute query with parameters for pagination

        passengers = cursor.fetchall()

        # Debug: Log the query results
        print(f"Found {len(passengers)} passengers")

        if len(passengers) == 0:
            print("No passengers found with the given criteria.")  # Debugging

        passenger_data = []
        for passenger in passengers:
            passenger_data.append({
                'BD_ID': passenger[0],
                'Booking_ID': passenger[1],
                'User_ID': passenger[2],
                'boarding_time': str(passenger[3]) if passenger[3] else "N/A",  # Convert datetime/timedelta to string
                'disembarking_time': str(passenger[4]) if passenger[4] else "N/A",  # Convert datetime/timedelta to string
                'status': passenger[5],
                'Qrcode_ID': passenger[6],
                'Schedule_ID': passenger[7],
                'origin': origin_name,
                'destination': passenger[9],
                'departure_date': passenger[10],
                'departure_time': str(passenger[11]) if passenger[11] else "N/A"  # Handle time formatting
            })

        cursor.close()

    except Exception as e:
        print(f"Error executing search query: {e}")
        return jsonify({'error': 'Database query failed'}), 500

    return jsonify({
        'boardingData': passenger_data,
        'totalPages': total_pages,
        'currentPage': page
    })
