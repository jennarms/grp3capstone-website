from flask import Blueprint, request, jsonify
from app import mysql
import uuid
from datetime import datetime, timedelta
import traceback
import qrcode
from io import BytesIO

boarding_manualbooking_bp = Blueprint('boarding_manualbooking_bp', __name__)

# =======================
# USER REGISTRATION
# =======================
@boarding_manualbooking_bp.route('/register_user', methods=['POST'])
def register_user():
    data = request.get_json()

    first_name = data.get('first_name')
    last_name = data.get('last_name')
    address = data.get('address')
    contact_number = data.get('contact_number')
    age = data.get('age')
    gender = data.get('gender')

    # Validate fields
    if not all([first_name, last_name, address, contact_number, age, gender]):
        return jsonify({"error": "All fields are required"}), 400

    # Ensure age is a valid integer
    try:
        age = int(age)
    except ValueError:
        return jsonify({"error": "Age must be a valid number"}), 400

    try:
        cur = mysql.connection.cursor()

        # Insert user into the Users table
        cur.execute(""" 
            INSERT INTO Users (first_name, last_name, address, contact_number, age, gender, platform_source, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, 'MA', NOW())
        """, (first_name, last_name, address, contact_number, age, gender))

        # Commit and get last inserted ID
        mysql.connection.commit()

        user_id = cur.lastrowid
        user_id_formatted = f"UID{user_id:03d}"

        # Update the Users table with the generated user_id
        cur.execute("""
            UPDATE Users 
            SET User_ID = %s 
            WHERE User_ID IS NULL AND first_name = %s AND last_name = %s
        """, (user_id_formatted, first_name, last_name))

        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "User registered successfully", "user_id": user_id_formatted}), 201
    except Exception as e:
        print(f"Error occurred: {e}")
        return jsonify({"error": "Internal server error"}), 500

# =======================
# CREATE BOOKING
# =======================
@boarding_manualbooking_bp.route('/create_booking', methods=['POST'])
def create_booking():
    data = request.get_json()

    user_id = data.get('user_id')
    origin = data.get('origin')
    destination = data.get('destination')
    departure_date = data.get('departure_date')
    departure_time = data.get('departure_time')

    # Validate user_id and other required fields
    if not all([user_id, origin, destination, departure_date, departure_time]):
        return jsonify({"error": "All fields are required"}), 400

    # Validate departure date (Ensure it's not Sunday)
    try:
        dep_date = datetime.strptime(departure_date, "%Y-%m-%d").date()
        if dep_date.weekday() == 6:  # Sunday
            return jsonify({"error": "Booking is not allowed on Sundays"}), 400
    except ValueError:
        return jsonify({"error": "Invalid date format, expected YYYY-MM-DD"}), 400

    try:
        cur = mysql.connection.cursor()

        # Step 1: Create Booking without QR Code
        cur.execute("""
            INSERT INTO Booking (User_ID, origin, destination, departure_date, departure_time, booking_source, payment_status)
            VALUES (%s, %s, %s, %s, %s, 'MA', 'NP')
        """, (user_id, origin, destination, departure_date, departure_time))
        mysql.connection.commit()
        booking_id = cur.lastrowid
        booking_id_formatted = f"BK{booking_id:06d}"

        # Step 2: Generate QR Code for Booking
        img = qrcode.make(booking_id_formatted)
        img_byte_arr = BytesIO()
        img.save(img_byte_arr)
        img_byte_arr.seek(0)

        # Save QR Code to DB and associate with booking
        cur.execute("""
            INSERT INTO QRCode (Booking_ID, Generated_at, ExpiresAt, Maximum_Scan)
            VALUES (%s, NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR), 3)
        """, (booking_id,))
        mysql.connection.commit()
        qr_code_id = cur.lastrowid
        qr_code_formatted = f"QR{qr_code_id:06d}"

        # Step 3: Update Booking with QR Code
        cur.execute("""
            UPDATE Booking
            SET Qrcode_ID = %s
            WHERE Booking_ID = %s
        """, (qr_code_formatted, booking_id))
        mysql.connection.commit()

        cur.close()

        return jsonify({
            "booking_id": booking_id_formatted,
            "qr_code": qr_code_formatted
        }), 201
    except Exception as e:
        print(f"Error occurred while creating booking: {e}")
        return jsonify({"error": "Internal server error"}), 500


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
