from flask import Blueprint, request, jsonify
from app import mysql
import uuid
from datetime import datetime
import traceback
import qrcode
from io import BytesIO

boarding_manualbooking_bp = Blueprint('boarding_manualbooking_bp', __name__)

# =======================
# MODULE 1: USER INFORMATION
# =======================
@boarding_manualbooking_bp.route('/register_user', methods=['POST'])
def register_user():
    data = request.get_json()
    print(f"Received data: {data}")  # Log received data

    first_name = data.get('first_name')
    last_name = data.get('last_name')
    address = data.get('address')
    profession = data.get('profession')
    contact_number = data.get('contact_number')
    age = data.get('age')
    gender = data.get('gender')

    # Validate fields
    if not all([first_name, last_name, address, profession, contact_number, age, gender]):
        return jsonify({"error": "All fields are required"}), 400

    # Ensure age is a valid integer
    try:
        age = int(age)
    except ValueError:
        return jsonify({"error": "Age must be a valid number"}), 400

    try:
        cur = mysql.connection.cursor()

        # Insert into the Users table (without specifying User_ID)
        cur.execute("""
            INSERT INTO Users (first_name, last_name, address, profession, contact_number, age, gender, platform_source, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'MA', NOW())
        """, (first_name, last_name, address, profession, contact_number, age, gender))

        # Commit and get last inserted ID
        mysql.connection.commit()

        user_id = cur.lastrowid
        user_id_formatted = f"UID{user_id:03d}"

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
        return jsonify({"error": str(e)}), 500

# =======================
# MODULE 2: BOOKING DETAILS
# =======================
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
        cur.execute("""
            INSERT INTO Booking (User_ID, origin, destination, departure_date, departure_time, booking_source, payment_status)
            VALUES (%s, %s, %s, %s, %s, 'MA', 'NP')
        """, (user_id, origin, destination, departure_date, departure_time))
        mysql.connection.commit()
        booking_id = cur.lastrowid
        booking_id_formatted = f"BK{booking_id:06d}"
        cur.close()

        return jsonify({"message": "Booking created successfully", "booking_id": booking_id_formatted}), 201
    except Exception as e:
        print(f"Error occurred while creating booking: {e}")
        print(traceback.format_exc())  # Log the full traceback
        return jsonify({"error": str(e)}), 500


# =======================
# MODULE 3: FARE & PAYMENT
# =======================
@boarding_manualbooking_bp.route('/get_fare', methods=['GET'])
def get_fare():
    origin = request.args.get("origin")
    destination = request.args.get("destination")

    if not origin or not destination:
        return jsonify({"error": "Origin and destination are required"}), 400

    try:
        cur = mysql.connection.cursor()
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

@boarding_manualbooking_bp.route('/update_payment', methods=['POST'])
def update_payment():
    data = request.get_json()

    booking_id = data.get('booking_id')
    paid_amount = data.get('paid_amount')  # Amount received as payment

    if not all([booking_id, paid_amount]):
        return jsonify({"error": "Booking ID and Paid Amount are required"}), 400

    try:
        cur = mysql.connection.cursor()
        cur.execute("""
            UPDATE Booking
            SET payment_status = 'P', paid_amount = %s, paid_at = NOW()
            WHERE Booking_ID = %s
        """, (paid_amount, booking_id))
        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Payment received successfully"}), 200
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# =======================
# MODULE 4: QR CODE GENERATION
# =======================
@boarding_manualbooking_bp.route('/generate_qr', methods=['POST'])
def generate_qr_code():
    booking_id = request.get_json().get('booking_id')

    if not booking_id:
        return jsonify({"error": "Booking ID is required"}), 400

    try:
        img = qrcode.make(booking_id)
        img_byte_arr = BytesIO()
        img.save(img_byte_arr)
        img_byte_arr.seek(0)

        qr_code = save_qr_code(booking_id, img_byte_arr)

        cur = mysql.connection.cursor()
        cur.execute("""
            UPDATE Booking
            SET qrCodeID = %s
            WHERE Booking_ID = %s
        """, (qr_code, booking_id))
        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "QR Code generated successfully", "qr_code": qr_code}), 200
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

def save_qr_code(booking_id, qr_code):
    try:
        cur = mysql.connection.cursor()
        cur.execute("""
            INSERT INTO QRCode (Booking_ID, Generated_at, ExpiresAt, Maximum_Scan)
            VALUES (%s, NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR), 3)
        """, (booking_id,))
        mysql.connection.commit()

        qr_code_id = cur.lastrowid
        qr_code_formatted = f"QR{qr_code_id:06d}"

        return qr_code_formatted
    except Exception as e:
        print(f"Error saving QR code: {e}")
        return None

@boarding_manualbooking_bp.route('/check_qr_exists', methods=['POST'])
def check_qr_exists():
    data = request.get_json()
    qr_code = data.get('qr_code')

    if not qr_code:
        return jsonify({"error": "QR Code is required"}), 400

    try:
        cur = mysql.connection.cursor()

        # Check if the QR code already exists in the QRCode table
        cur.execute("SELECT COUNT(*) FROM QRCode WHERE QRCode_ID = %s", (qr_code,))
        count = cur.fetchone()[0]

        if count > 0:
            # QR code exists, increment the last QR code by 1
            cur.execute("SELECT MAX(CAST(SUBSTRING(QRCode_ID, 3) AS UNSIGNED)) FROM QRCode")
            last_qr_code = cur.fetchone()[0]  # Get the last incremented QR code
            new_qr_code = last_qr_code + 1 if last_qr_code is not None else 10000
            new_qr_code_id = f"TC{new_qr_code}"

            return jsonify({"exists": True, "new_qr_code": new_qr_code_id}), 200
        else:
            # QR code does not exist
            return jsonify({"exists": False}), 200

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


