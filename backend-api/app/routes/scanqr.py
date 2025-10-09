from flask import Blueprint, request, jsonify
from app import mysql
from datetime import datetime

# Create a Blueprint for the scanning
scanqr_bp = Blueprint('scanqr_bp', __name__)

# -------------------------------------------------------------------
# Helper function to handle QR scanning
# -------------------------------------------------------------------
def process_scan(qr_code, station_id):
    """Process the scanned QR code and return boarding info or QR Denied."""
    cursor = mysql.connection.cursor()
    
    try:
        # Step 1: Check if the QR code exists in the Booking table
        cursor.execute("""
            SELECT b.Booking_ID, b.User_ID, b.origin, b.destination, b.departure_date, b.departure_time, b.booking_status, u.first_name, u.last_name
            FROM Booking b
            JOIN Users u ON b.User_ID = u.User_ID
            WHERE b.Qrcode_ID = %s
            AND b.booking_status = 'PE'  -- Pending status
        """, (qr_code,))
        
        booking = cursor.fetchone()
        
        if booking:
            # Step 2: If booking exists, process it (boarding the passenger)
            booking_id, user_id, origin, destination, departure_date, departure_time, booking_status, first_name, last_name = booking
            
            # Insert the boarding record into BoardingDisembarking table
            boarding_time = datetime.now()
            cursor.execute("""
                INSERT INTO BoardingDisembarking (BD_ID, Booking_ID, Station_ID, boarding_time, status, handled_by)
                VALUES (UUID(), %s, %s, %s, 'B', %s)
            """, (booking_id, station_id, boarding_time, "Station Admin"))  # "Station Admin" can be replaced with actual admin
            
            mysql.connection.commit()
            
            # Return passenger info as confirmation
            return jsonify({
                "status": "success",
                "message": "Passenger confirmed 🎉",
                "passenger": {
                    "name": f"{first_name} {last_name}",
                    "code": qr_code,
                    "from": origin,
                    "to": destination,
                    "departure_date": departure_date,
                    "departure_time": departure_time
                }
            }), 200
        else:
            # Step 3: If QR code is invalid or not found, deny it
            return jsonify({
                "status": "error",
                "message": "QR Denied ❌",
                "error_details": "QR code not found or not pending."
            }), 404

    except Exception as e:
        # Handle any errors
        mysql.connection.rollback()
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500
    finally:
        cursor.close()

# -------------------------------------------------------------------
# Route to handle QR scan
# -------------------------------------------------------------------
@scanqr_bp.route('/api/scanqr', methods=['POST'])
def scan_qr():
    """Endpoint to scan and process QR code."""
    data = request.get_json()
    
    qr_code = data.get("qr_code")
    station_id = data.get("station_id")
    
    if not qr_code or not station_id:
        return jsonify({
            "status": "error",
            "message": "Missing QR code or Station ID"
        }), 400
    
    return process_scan(qr_code, station_id)
