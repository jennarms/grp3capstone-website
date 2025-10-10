from flask import Blueprint, request, jsonify
from flask_mysqldb import MySQL

# Initialize MySQL
mysql = MySQL()

# Create a new blueprint for the passenger table
boarding_passengertable_bp = Blueprint('boarding_passengertable_bp', __name__)

# Create a pending booking
@boarding_passengertable_bp.route('/create_pending_booking', methods=['POST'])
def create_pending_booking():
    data = request.get_json()

    # Extract data from the incoming request
    booking_id = data.get('booking_id')
    user_id = data.get('user_id')
    qrcode_id = data.get('qrcode_id')
    schedule_id = data.get('schedule_id')

    cursor = mysql.connection.cursor()

    # Step 1: Fetch the booking details from the Booking table to validate the booking
    cursor.execute("SELECT * FROM Booking WHERE Booking_ID = %s", (booking_id,))
    booking_data = cursor.fetchone()

    if not booking_data:
        return jsonify({"error": "Booking not found"}), 404  # If the booking doesn't exist

    # Step 2: Fetch user details from the Users table
    cursor.execute("SELECT * FROM Users WHERE User_ID = %s", (user_id,))
    user_data = cursor.fetchone()

    if not user_data:
        return jsonify({"error": "User not found"}), 404  # If the user doesn't exist

    # Step 3: Insert the new record with status "Pending" into BoardingDisembarking
    insert_query = """
    INSERT INTO BoardingDisembarking 
    (User_ID, Booking_ID, status, boarding_time, disembarking_time, Qrcode_ID, Schedule_ID, 
    origin, destination, departure_date, departure_time) 
    VALUES (%s, %s, %s, NULL, NULL, %s, %s, %s, %s, %s, %s)
    """
    
    cursor.execute(insert_query, (
        user_id, booking_id, 'P', qrcode_id, schedule_id,
        booking_data[3], booking_data[4], booking_data[5], booking_data[6]
    ))

    mysql.connection.commit()
    cursor.close()

    return jsonify({"message": "Booking created and status set to Pending"}), 200


# Update boarding status
@boarding_passengertable_bp.route('/update_boarding_status', methods=['POST'])
def update_boarding_status():
    data = request.get_json()

    user_id = data.get('user_id')
    booking_id = data.get('booking_id')
    status = data.get('status')  # "B" for Boarded, "C" for Cancelled, "D" for Disembarked
    boarding_time = data.get('boarding_time')
    disembarking_time = data.get('disembarking_time')

    cursor = mysql.connection.cursor()

    # Step 1: Check if the booking exists
    cursor.execute("SELECT * FROM BoardingDisembarking WHERE User_ID = %s AND Booking_ID = %s", (user_id, booking_id))
    bd_data = cursor.fetchone()

    if not bd_data:
        return jsonify({"error": "Boarding record not found"}), 404

    # Step 2: Update the status based on the provided status
    if status == 'P':  # Pending
        update_query = """
        UPDATE BoardingDisembarking
        SET status = %s
        WHERE User_ID = %s AND Booking_ID = %s
        """
        cursor.execute(update_query, (status, user_id, booking_id))

    elif status == 'B':  # Boarded
        update_query = """
        UPDATE BoardingDisembarking
        SET status = %s, boarding_time = %s
        WHERE User_ID = %s AND Booking_ID = %s
        """
        cursor.execute(update_query, (status, boarding_time, user_id, booking_id))

    elif status == 'C':  # Cancelled
        update_query = """
        UPDATE BoardingDisembarking
        SET status = %s, boarding_time = NULL, disembarking_time = NULL
        WHERE User_ID = %s AND Booking_ID = %s
        """
        cursor.execute(update_query, (status, user_id, booking_id))

    elif status == 'D':  # Disembarked
        update_query = """
        UPDATE BoardingDisembarking
        SET status = %s, disembarking_time = %s
        WHERE User_ID = %s AND Booking_ID = %s
        """
        cursor.execute(update_query, (status, disembarking_time, user_id, booking_id))

    mysql.connection.commit()
    cursor.close()

    return jsonify({"message": "Boarding status updated successfully"}), 200


# Fetch boarding details with pagination
@boarding_passengertable_bp.route('/get_boarding_details', methods=['GET'])
def get_boarding_details():
    # Get the current page and page size (pagination)
    page = request.args.get('page', 1, type=int)  # Default page is 1
    page_size = request.args.get('page_size', 10, type=int)  # Default page size is 10

    cursor = mysql.connection.cursor()

    # Modify the query to include LIMIT and OFFSET for pagination
    query = """
    SELECT 
        BD.BD_ID, 
        BD.Booking_ID, 
        U.first_name, 
        U.last_name, 
        BD.status, 
        BD.boarding_time, 
        BD.disembarking_time, 
        BD.origin, 
        BD.destination, 
        BD.departure_date, 
        BD.departure_time
    FROM 
        BoardingDisembarking BD
    JOIN 
        Users U ON BD.User_ID = U.User_ID
    JOIN
        Booking B ON BD.Booking_ID = B.Booking_ID
    WHERE 
        BD.status = 'P'  # Pending status
    LIMIT %s OFFSET %s
    """
    # Calculate the offset based on the page number
    offset = (page - 1) * page_size

    cursor.execute(query, (page_size, offset))
    result = cursor.fetchall()
    cursor.close()

    boarding_data = [
        {
            "BD_ID": row[0],
            "Booking_ID": row[1],
            "first_name": row[2],
            "last_name": row[3],
            "status": row[4],
            "boarding_time": row[5],
            "disembarking_time": row[6],
            "origin": row[7],
            "destination": row[8],
            "departure_date": row[9],
            "departure_time": row[10]
        }
        for row in result
    ]

    return jsonify(boarding_data)
