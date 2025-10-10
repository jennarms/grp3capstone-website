from flask import Blueprint, request, jsonify
from app import mysql  # Assuming mysql connection setup is imported here
from math import ceil  # For calculating totalPages

boarding_passengertable_bp = Blueprint('boarding_passengertable_bp', __name__)

# Route to fetch passenger data based on origin and schedule
@boarding_passengertable_bp.route('/get_boarding_details', methods=['GET'])
def get_boarding_details():
    # Get origin, schedule_time, and page from query parameters
    origin = request.args.get('origin')
    schedule_time = request.args.get('schedule_time')  # example: '8:05'
    page = int(request.args.get('page', 1))  # Default to page 1 if no page is passed
    query = request.args.get('query', '')  # Optional query for searching

    if not origin or not schedule_time:
        return jsonify({'error': 'Origin and schedule_time are required'}), 400

    # Number of records per page
    records_per_page = 10
    offset = (page - 1) * records_per_page  # Calculate the offset based on page number

    # MySQL query to fetch the total count of records matching the origin and schedule_time
    count_query = """
        SELECT COUNT(*) FROM BoardingDisembarking
        WHERE origin = %s
          AND departure_time = %s
          AND status != 'C'  # Exclude cancelled records
    """
    
    cursor = mysql.connection.cursor()
    cursor.execute(count_query, (origin, schedule_time))
    total_records = cursor.fetchone()[0]  # Get the total number of records
    cursor.close()

    # Calculate total pages
    total_pages = ceil(total_records / records_per_page)

    # Query to fetch passenger data with pagination (limit and offset)
    query = """
        SELECT BD_ID, Booking_ID, User_ID, boarding_time, disembarking_time, status,
               Qrcode_ID, Schedule_ID, origin, destination, departure_date, departure_time
        FROM BoardingDisembarking
        WHERE origin = %s
          AND departure_time = %s
          AND status != 'C'  # Exclude cancelled records
        LIMIT %s OFFSET %s
    """

    # Establish a connection and execute the query
    cursor = mysql.connection.cursor()
    cursor.execute(query, (origin, schedule_time, records_per_page, offset))  # Execute query with parameters

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
            'origin': passenger[8],
            'destination': passenger[9],
            'departure_date': passenger[10],
            'departure_time': passenger[11]
        })

    # Close the cursor
    cursor.close()

    # Return the passenger data in JSON format along with pagination info
    return jsonify({
        'boardingData': passenger_data,
        'totalPages': total_pages,  # Pass the total number of pages for pagination
        'currentPage': page
    })
