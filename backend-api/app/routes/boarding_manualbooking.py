from flask import Blueprint, request, jsonify
from app import mysql
import uuid
from datetime import datetime, timedelta
import traceback
import qrcode
from io import BytesIO
from datetime import datetime

boarding_manualbooking_bp = Blueprint('boarding_manualbooking_bp', __name__)

# =======================
# USER REGISTRATION
# =======================
def generate_user_id(cursor):
    """Generate next ID like UID001, UID002... based on MAX(User_ID)."""
    cursor.execute("SELECT MAX(User_ID) FROM Users")
    last_id = (cursor.fetchone() or [None])[0]
    if last_id and last_id.startswith("UID") and last_id[3:].isdigit():
        new_num = int(last_id[3:]) + 1
    else:
        new_num = 1
    return f"UID{new_num:03d}"

@boarding_manualbooking_bp.route('/register_user', methods=['POST'])
def register_user():
    data = request.get_json()

    first_name = data.get('first_name')
    last_name = data.get('last_name')
    address = data.get('address')
    contact_number = data.get('contact_number')
    age = data.get('age')
    gender = data.get('gender')
    email = data.get('email')  # Email can be an empty string or null

    # Validate fields
    if not all([first_name, last_name, address, contact_number, age, gender]):
        return jsonify({"error": "First name, last name, address, contact number, age, and gender are required"}), 400

    # Ensure age is a valid integer
    try:
        age = int(age)
    except ValueError:
        return jsonify({"error": "Age must be a valid number"}), 400

    # Validate email if provided
    if email and not isinstance(email, str):
        return jsonify({"error": "Email must be a valid string"}), 400

    if email == '':
        email = None  # Set it as None (NULL) if empty string is passed

    try:
        cur = mysql.connection.cursor()

        # Generate user_id using custom function
        user_id = generate_user_id(cur)

        # Insert user into the Users table with email
        cur.execute(""" 
            INSERT INTO Users (User_ID, first_name, last_name, address, contact_number, age, gender, email, platform_source, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'MB', NOW())
        """, (user_id, first_name, last_name, address, contact_number, age, gender, email))

        # Commit the insert and get the last inserted ID (this is the actual auto-incremented ID)
        mysql.connection.commit()

        # Check if the user was successfully created
        if cur.rowcount == 0:
            return jsonify({"error": "User creation failed."}), 500

        # Commit the transaction and close the cursor
        cur.close()

        return jsonify({"message": "User registered successfully", "user_id": user_id}), 201
    except Exception as e:
        print(f"Error occurred: {str(e)}")
        print(traceback.format_exc())  # Print the full traceback for debugging
        return jsonify({"error": f"Internal server error: {str(e)}", "trace": traceback.format_exc()}), 500


# =======================
# CREATE BOOKING
# =======================
def generate_booking_id(cursor):
    """Generate next Booking ID like BK000001, BK000002... based on MAX(Booking_ID)."""
    cursor.execute("SELECT MAX(CAST(SUBSTRING(Booking_ID, 3) AS UNSIGNED)) AS max_num FROM Booking")
    row = cursor.fetchone()
    last = (row["max_num"] if isinstance(row, dict) else row[0]) if row else 0
    nxt = (last or 0) + 1
    return f"BK{nxt:06d}"

def generate_qrcode_id(cursor):
    """Generate next QR Code ID like QR000001, QR000002... based on MAX(Qrcode_ID)."""
    cursor.execute("SELECT MAX(CAST(SUBSTRING(Qrcode_ID, 3) AS UNSIGNED)) AS max_num FROM QRCode")
    row = cursor.fetchone()
    last = (row["max_num"] if isinstance(row, dict) else row[0]) if row else 0
    nxt = (last or 0) + 1
    return f"QR{nxt:06d}"

def convert_to_24hr_format(departure_time):
    try:
        # Convert from 12-hour format (e.g., '8:05 PM') to 24-hour format (e.g., '20:05:00')
        time_24hr = datetime.strptime(departure_time, "%I:%M %p").strftime("%H:%M:%S")
        return time_24hr
    except ValueError:
        raise ValueError("Invalid time format, expected 12-hour format with AM/PM")


@boarding_manualbooking_bp.route('/create_booking', methods=['POST'])
def create_booking():
    data = request.get_json()

    user_id = data.get('user_id')
    origin = data.get('origin')  # Station name (origin)
    destination = data.get('destination')  # Station name (destination)
    departure_date = data.get('departure_date')
    departure_time = data.get('departure_time')

    # Validate user_id and other required fields
    if not all([user_id, origin, destination, departure_date, departure_time]):
        return jsonify({"error": "All fields are required"}), 400

    # Validate that the user exists
    try:
        cur = mysql.connection.cursor()
        cur.execute("SELECT User_ID FROM Users WHERE User_ID = %s", (user_id,))
        user = cur.fetchone()

        if not user:
            return jsonify({"error": "User does not exist"}), 400  # User not found

    except Exception as e:
        print(f"Error occurred during user validation: {str(e)}")
        print(traceback.format_exc())  # Print the full traceback for debugging
        return jsonify({"error": f"Error validating user: {str(e)}", "trace": traceback.format_exc()}), 500

    # Validate departure date (Ensure it's not Sunday)
    try:
        dep_date = datetime.strptime(departure_date, "%Y-%m-%d").date()
        if dep_date.weekday() == 6:  # Sunday
            return jsonify({"error": "Booking is not allowed on Sundays"}), 400
    except ValueError:
        return jsonify({"error": "Invalid date format, expected YYYY-MM-DD"}), 400

    try:
        cur = mysql.connection.cursor()

        # Step 1: Convert Station Names to Station_IDs
        # Fetch Station_ID for origin station
        cur.execute("SELECT Station_ID FROM Station WHERE StationName = %s", (origin,))
        origin_station = cur.fetchone()
        if not origin_station:
            return jsonify({"error": f"Origin station '{origin}' not found"}), 400
        origin_station_id = origin_station[0]

        # Fetch Station_ID for destination station
        cur.execute("SELECT Station_ID FROM Station WHERE StationName = %s", (destination,))
        destination_station = cur.fetchone()
        if not destination_station:
            return jsonify({"error": f"Destination station '{destination}' not found"}), 400
        destination_station_id = destination_station[0]

        # Generate a custom Booking_ID using generate_booking_id function
        booking_id = generate_booking_id(cur)

        # Step 2: Create the Booking with Station IDs
        cur.execute("""
            INSERT INTO Booking (Booking_ID, User_ID, origin, destination, departure_date, departure_time, Schedule_ID, booking_source, payment_status)
            VALUES (%s, %s, %s, %s, %s, %s, 'MB', 'NP')
        """, (booking_id, user_id, origin_station_id, destination_station_id, departure_date, departure_time))
        mysql.connection.commit()

        # Step 3: Generate QR Code ID
        qrcode_id = generate_qrcode_id(cur)
        print(f"Generated QR Code ID: {qrcode_id}")  # Debugging output

        # Step 4: Insert the QR Code into the QRCode table with explicit UTC conversion to Asia/Manila time zone
        cur.execute("""
            INSERT INTO QRCode (Booking_ID, User_ID, Qrcode_ID, Generated_at, ExpiresAt, Maximum_Scan)
            VALUES (%s, %s, %s, CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', 'Asia/Manila'), CONVERT_TZ(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR), '+00:00', 'Asia/Manila'), 2)
        """, (booking_id, user_id, qrcode_id))
        mysql.connection.commit()

        # Step 5: Update Booking with the generated QR Code ID
        cur.execute("""
            UPDATE Booking
            SET Qrcode_ID = %s
            WHERE Booking_ID = %s
        """, (qrcode_id, booking_id))
        mysql.connection.commit()

        cur.close()

        return jsonify({
            "booking_id": booking_id,
            "qr_code": qrcode_id
        }), 201
    except Exception as e:
        print(f"Error occurred while creating booking: {str(e)}")
        print(traceback.format_exc())  # Print the full traceback for debugging
        return jsonify({"error": f"Internal server error: {str(e)}", "trace": traceback.format_exc()}), 500

# =======================
# GET STATIONS
# =======================
@boarding_manualbooking_bp.route('/get_stations', methods=['GET'])
def get_stations():
    try:
        cur = mysql.connection.cursor()

        # Get all stations
        cur.execute("SELECT Station_ID, StationName FROM Station")
        stations = cur.fetchall()

        return jsonify({"stations": [{"Station_ID": station[0], "StationName": station[1]} for station in stations]}), 200
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": "Internal server error"}), 500

# =======================
# GET DEPARTURE SCHEDULES
# =======================
@boarding_manualbooking_bp.route('/get_departure_schedules', methods=['GET'])
def get_departure_schedules():
    origin = request.args.get("origin")  # Station Name
    destination = request.args.get("destination")  # Station Name

    print(f"Origin: {origin}, Destination: {destination}")  # Log received data

    if not origin or not destination or origin == destination:
        return jsonify({"schedules": []}), 200  # Return an empty array as per frontend expectations

    try:
        cur = mysql.connection.cursor()

        # Step 1: Get Station IDs based on the Station Names provided
        cur.execute("""
            SELECT Station_ID
            FROM Station
            WHERE StationName = %s
        """, (origin,))
        origin_station = cur.fetchone()
        print(f"Origin Station: {origin_station}")  # Debugging output

        cur.execute("""
            SELECT Station_ID
            FROM Station
            WHERE StationName = %s
        """, (destination,))
        destination_station = cur.fetchone()
        print(f"Destination Station: {destination_station}")  # Debugging output

        if not origin_station or not destination_station:
            return jsonify({"error": "Invalid station name(s)"}), 400

        # Correct way to access the Station_ID from the tuple
        origin_station_id = origin_station[0]  # Access the first element of the tuple
        destination_station_id = destination_station[0]  # Access the first element of the tuple

        # Step 2: Find ONE route that contains both stations in the correct direction
        cur.execute("""
            SELECT r.Route_ID
            FROM Route r
            JOIN RouteStations rs1 ON r.Route_ID = rs1.Route_ID AND rs1.Station_ID = %s
            JOIN RouteStations rs2 ON r.Route_ID = rs2.Route_ID AND rs2.Station_ID = %s
            WHERE rs1.StopOrder < rs2.StopOrder
            ORDER BY r.Route_ID ASC
            LIMIT 1
        """, (origin_station_id, destination_station_id))

        row = cur.fetchone()
        if not row:
            return jsonify({"schedules": []}), 200  # No schedules found, return empty list

        route_id = row[0]  # Access Route_ID from the tuple

        # Step 3: Fetch schedules for the origin station on the selected route
        cur.execute("""
            SELECT s.departureTime, rs.Station_ID, rs.StopOrder
            FROM Schedule s
            JOIN RouteStations rs ON s.RouteStation_ID = rs.RouteStation_ID
            WHERE rs.Station_ID = %s
              AND s.Route_ID = %s
              AND s.departureTime IS NOT NULL
            ORDER BY rs.StopOrder, s.departureTime
        """, (origin_station_id, route_id))

        rows = cur.fetchall()
        if not rows:
            return jsonify({"schedules": []}), 200  # Return empty schedules if none found

        # Step 4: Format times and return
        schedules = []
        for r in rows:
            val = r[0]  # Access departureTime from the tuple
            if not val:
                schedules.append("No time available")  # Placeholder for NULL times
                continue

            if isinstance(val, timedelta):
                # Convert timedelta to hours/minutes
                total_seconds = val.days * 86400 + val.seconds  # include days just in case
                hours = total_seconds // 3600
                minutes = (total_seconds % 3600) // 60
                ampm = "AM" if hours < 12 else "PM"
                hour12 = hours % 12 or 12
                schedules.append(f"{hour12:02d}:{minutes:02d} {ampm}")
            else:
                schedules.append(str(val))

        return jsonify({"schedules": schedules}), 200  # Return schedules in the required format

    except Exception as e:
        print(f"Error occurred: {str(e)}")  # Print detailed error
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500
    finally:
        try:
            if cur:
                cur.close()
        except:
            pass

# =======================
# GET FARE
# =======================
@boarding_manualbooking_bp.route('/get_fare', methods=['GET'])
def get_fare():
    origin = request.args.get("origin")
    destination = request.args.get("destination")
    if not origin or not destination:
        return jsonify({"error": "Origin and destination are required"}), 400

    try:
        cur = mysql.connection.cursor()

        # Fetch fare from Fare table based on origin and destination
        cur.execute("""
            SELECT Fare FROM Fare 
            WHERE From_Station_ID = (SELECT Station_ID FROM Station WHERE StationName = %s)
            AND To_Station_ID = (SELECT Station_ID FROM Station WHERE StationName = %s)
        """, (origin, destination))
        fare = cur.fetchone()

        if fare:
            return jsonify({"fare": fare[0]}), 200
        else:
            return jsonify({"error": "Fare not found for the selected route"}), 404
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": "Internal server error"}), 500
    
@boarding_manualbooking_bp.route('/update_payment', methods=['POST'])
def update_payment():
    data = request.get_json()

    booking_id = data.get('Booking_ID')
    paid_amount = data.get('payment_amount')

    if not booking_id or not paid_amount:
        return jsonify({"error": "Booking ID and paid amount are required"}), 400

    try:
        cur = mysql.connection.cursor()

        # Step 1: Check if the booking exists
        cur.execute("SELECT Booking_ID FROM Booking WHERE Booking_ID = %s", (booking_id,))
        booking = cur.fetchone()
        if not booking:
            return jsonify({"error": "Booking not found"}), 404

        # Step 2: Update the payment status and paid amount
        cur.execute("""
            UPDATE Booking 
            SET payment_amount = %s, payment_status = 'P' 
            WHERE Booking_ID = %s
        """, (paid_amount, booking_id))

        mysql.connection.commit()

        cur.close()

        return jsonify({"message": "Payment updated successfully"}), 200
    except Exception as e:
        print(f"Error occurred: {str(e)}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500
