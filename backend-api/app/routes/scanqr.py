from datetime import datetime
from flask import Blueprint, request, jsonify
from app import mysql

# Create a Blueprint for QR scanning
scanqr_bp = Blueprint('scanqr_bp', __name__)

@scanqr_bp.route('/scan_qrcode', methods=['POST'])
def scan_qrcode():
    data = request.get_json()
    qr_id = data.get('QRCode_ID')
    action = data.get('action')  # 'boarding' or 'disembarking'
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    if not qr_id or not action:
        return jsonify({"error": "QR Code ID and action (boarding/disembarking) are required"}), 400

    if action not in ['boarding', 'disembarking']:
        return jsonify({"error": "Invalid action. Must be either 'boarding' or 'disembarking'"}), 400

    cursor = mysql.connection.cursor()
    try:
        # Check if QR exists in BoardingDisembarking for boarding (status 'P')
        cursor.execute("""
            SELECT BD_ID, status, User_ID, Schedule_ID, origin, destination
            FROM BoardingDisembarking 
            WHERE QRCode_ID=%s
        """, (qr_id,))
        bd = cursor.fetchone()

        if not bd:
            return jsonify({"error": "QR Code not found in boarding list"}), 404

        bd_id, status, user_id, schedule_id, origin, destination = bd

        # Fetch the passenger's full name from the Users table by concatenating first_name and last_name
        cursor.execute("""
            SELECT CONCAT(first_name, ' ', last_name) AS full_name
            FROM Users 
            WHERE User_ID=%s
        """, (user_id,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"error": "Passenger not found"}), 404

        name = user[0]  # This will contain the full name

        # Handle Boarding action
        if action == 'boarding':
            if status != 'P':  # If status isn't 'P', then it's not pending, can't board
                return jsonify({"error": "QR Code is not in pending status or already boarded"}), 400
            
            # Update BoardingDisembarking for boarding
            cursor.execute("""
                UPDATE BoardingDisembarking
                SET status='B', boarding_time=%s
                WHERE BD_ID=%s
            """, (now, bd_id))

            # Update QRCode table for boarding (decrease Maximum_Scan)
            cursor.execute("""
                UPDATE QRCode
                SET Maximum_Scan = Maximum_Scan - 1
                WHERE QRCode_ID=%s
            """, (qr_id,))

            message = "Passenger boarded successfully"

        # Handle Disembarking action
        elif action == 'disembarking':
            if status != 'B':  # If status isn't 'B', it's not boarded, can't disembark
                return jsonify({"error": "QR Code is not boarded yet or already disembarked"}), 400

            # Update BoardingDisembarking for disembarking
            cursor.execute("""
                UPDATE BoardingDisembarking
                SET status='D', disembarking_time=%s
                WHERE BD_ID=%s
            """, (now, bd_id))

            # Update QRCode for disembarking (set ExpiresAt and set Maximum_Scan to 0)
            cursor.execute("""
                UPDATE Qrcode
                SET ExpiresAt = %s, Maximum_Scan = 0
                WHERE Qrcode_ID=%s
            """, (now, qr_id))

            message = "Passenger disembarked successfully"

        # Commit changes to the database
        mysql.connection.commit()

        # Return the passenger's details to the frontend
        return jsonify({
            "message": message,
            "name": name,
            "code": qr_id,
            "from": origin,
            "to": destination,
            "boarding_time" if action == 'boarding' else "disembarking_time": now
        }), 200

    except Exception as e:
        mysql.connection.rollback()
        print("Scan error:", e)
        return jsonify({"error": f"Failed to update boarding or disembarking. Error: {str(e)}"}), 500
    finally:
        cursor.close()