from flask import Blueprint, request, jsonify
from app import mysql
import uuid
from datetime import datetime
import traceback
import qrcode
from io import BytesIO

boarding_manualbooking_bp = Blueprint('boarding_manualbooking_bp', __name__)

# =====================
# MODULE 1: USER INFORMATION
# =====================
@boarding_manualbooking_bp.route('/register_user', methods=['POST'])
def register_user():
    data = request.get_json()
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    address = data.get('address')
    profession = data.get('profession')
    contact_number = data.get('contact_number')
    age = data.get('age')
    gender = data.get('gender')

    # Check if all required fields are provided
    if not all([first_name, last_name, address, profession, contact_number, age, gender]):
        return jsonify({"error": "All fields are required"}), 400

    try:
        cur = mysql.connection.cursor()

        # Insert into Users table
        cur.execute("""
            INSERT INTO Users (first_name, last_name, address, profession, contact_number, age, gender, platform_source, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'MA', NOW())
        """, (first_name, last_name, address, profession, contact_number, age, gender))
        mysql.connection.commit()

        # Fetch the last inserted User_ID
        user_id = cur.lastrowid
        user_id_formatted = f"UID{user_id:03d}"

        cur.close()
        return jsonify({"message": "User registered successfully", "user_id": user_id_formatted}), 201

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# =====================
# MODULE 2: BOOKING DETAILS
# =====================
@boarding_manualbooking_bp.route('/create_booking', methods=['POST'])
def create_booking():
    data = request.get_json()

    user_id = data.get('user_id')
    origin = data.get('origin')
    destination = data.get('destination')
    departure_date = data.get('departure_date')
    departure_time = data.get('departure_time')

    if not all([user_id, origin, destination, departure_date, departure_time]):
        return jsonify({"error": "All fields are required"}), 400

    try:
        cur = mysql.connection.cursor()

        # Insert booking details into Booking table
        cur.execute("""
            INSERT INTO Booking (User_ID, origin, destination, departure_date, departure_time, booking_source, payment_status)
            VALUES (%s, %s, %s, %s, %s, 'MA', 'NP')
        """, (user_id, origin, destination, departure_date, departure_time))
        mysql.connection.commit()

        # Fetch the last inserted Booking_ID
        booking_id = cur.lastrowid
        booking_id_formatted = f"BK{booking_id:06d}"

        cur.close()
        return jsonify({"message": "Booking created successfully", "booking_id": booking_id_formatted}), 201

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# =====================
# MODULE 3: FARE
# =====================
@boarding_manualbooking_bp.route('/get_fare', methods=['GET'])
def get_fare():
    origin = request.args.get("origin")
    destination = request.args.get("destination")

    if not origin or not destination:
        return jsonify({"error": "Origin and destination are required"}), 400

    try:
        cur = mysql.connection.cursor()

        # Fetch fare for the given route
        cur.execute("""
            SELECT Fare FROM Fare WHERE From_Station_ID = %s AND To_Station_ID = %s
        """, (origin, destination))
        fare = cur.fetchone()

        if fare:
            return jsonify({"fare": fare[0]}), 200
        else:
            return jsonify({"error": "Fare not found for the selected route"}), 404

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# =====================
# MODULE 4: QR CODE GENERATION
# =====================
@boarding_manualbooking_bp.route('/generate_qr', methods=['POST'])
def generate_qr_code():
    booking_id = request.get_json().get('booking_id')

    if not booking_id:
        return jsonify({"error": "Booking ID is required"}), 400

    try:
        # Generate a QR code for the booking ID
        img = qrcode.make(booking_id)
        img_byte_arr = BytesIO()
        img.save(img_byte_arr)
        img_byte_arr.seek(0)

        # You can save the QR code to a database or S3 here if needed

        return jsonify({"message": "QR Code generated successfully", "qr_code": "QR_CODE_IMAGE"}), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# =====================
# Save the QR Code to Database
# =====================
def save_qr_code(booking_id, qr_code):
    try:
        cur = mysql.connection.cursor()

        # Insert a record into QRCode table
        cur.execute("""
            INSERT INTO QRCode (Booking_ID, Generated_at, ExpiresAt, Maximum_Scan)
            VALUES (%s, NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR), 3)
        """, (booking_id,))
        mysql.connection.commit()

        # Fetch the last inserted QRCode_ID
        qr_code_id = cur.lastrowid
        qr_code_formatted = f"QR{qr_code_id:06d}"

        return qr_code_formatted

    except Exception as e:
        print(f"Error saving QR code: {e}")
        return None
