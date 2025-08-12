from flask import Blueprint, request, jsonify
from app import mysql, mail
import bcrypt
import random
import string
from datetime import datetime, timedelta
from flask_mail import Message
import traceback

main_admin_auth = Blueprint('main_admin_auth', __name__)

# Helper function to generate OTP
def generate_otp(length=6):
    return ''.join(random.choices(string.digits, k=length))

# =====================
# LOGIN
# =====================
@main_admin_auth.route('/login', methods=['POST'])
def main_admin_login():
    data = request.get_json()
    username_or_email = data.get('username')
    password = data.get('password')

    if not username_or_email or not password:
        return jsonify({"error": "Missing username/email or password"}), 400

    try:
        cur = mysql.connection.cursor()
        cur.execute("""
            SELECT passwordHash FROM MainAdmin
            WHERE username = %s OR email = %s
        """, (username_or_email, username_or_email))
        result = cur.fetchone()
        cur.close()

        if not result:
            return jsonify({"error": "Invalid username/email or password"}), 401

        stored_hash = result[0].encode('utf-8')

        if bcrypt.checkpw(password.encode('utf-8'), stored_hash):
            return jsonify({"message": "Login successful!"}), 200
        else:
            return jsonify({"error": "Invalid username/email or password"}), 401

    except Exception as err:
        return jsonify({"error": str(err)}), 500


# =====================
# FORGOT PASSWORD - SEND OTP
# =====================
@main_admin_auth.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    username = data.get('username')

    if not username:
        return jsonify({"error": "Username is required"}), 400

    try:
        cur = mysql.connection.cursor()
        # Get admin_id and email from username
        cur.execute("SELECT Admin_ID, email FROM MainAdmin WHERE username = %s", (username,))
        admin = cur.fetchone()

        if not admin:
            return jsonify({"error": "Username not found"}), 404

        admin_id, email = admin
        otp_code = generate_otp()
        expiration = datetime.utcnow() + timedelta(minutes=10)

        # Insert OTP
        cur.execute("""
            INSERT INTO OTP (OTP_ID, User_Type, Admin_ID, OTP_Code, Expiration, Is_Used, Created_At)
            VALUES (UUID(), 'A', %s, %s, %s, FALSE, NOW())
        """, (admin_id, otp_code, expiration))
        mysql.connection.commit()
        cur.close()

        # Send OTP
        msg = Message("Password Reset OTP", sender="noreply@example.com", recipients=[email])
        msg.body = f"Your OTP code is {otp_code}. It will expire in 10 minutes."
        mail.send(msg)

        return jsonify({"message": "OTP sent to email linked to this username"}), 200

    except Exception as err:
        return jsonify({"error": str(err)}), 500

# =====================
# RESET PASSWORD (One-Step)
# =====================
@main_admin_auth.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    username = data.get('username')
    otp_code = data.get('otp')
    new_password = data.get('new_password')
    confirm_password = data.get('confirm_password')

    # Validate input
    if not username or not otp_code or not new_password or not confirm_password:
        return jsonify({"error": "All fields are required"}), 400
    if new_password != confirm_password:
        return jsonify({"error": "Passwords do not match"}), 400

    try:
        cur = mysql.connection.cursor()

        # Verify OTP & get admin info
        cur.execute("""
            SELECT o.OTP_ID, o.Expiration, o.Is_Used, a.Admin_ID
            FROM OTP o
            JOIN MainAdmin a ON o.Admin_ID = a.Admin_ID
            WHERE a.username = %s AND o.OTP_Code = %s
            ORDER BY o.Created_At DESC LIMIT 1
        """, (username, otp_code))
        otp_record = cur.fetchone()

        if not otp_record:
            return jsonify({"error": "Invalid OTP"}), 400

        otp_id, expiration, is_used, admin_id = otp_record

        # Check OTP status
        if is_used:
            return jsonify({"error": "OTP already used"}), 400
        if datetime.utcnow() > expiration:
            return jsonify({"error": "OTP expired"}), 400

        # Hash password and decode for MySQL
        hashed_pw = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Update password
        cur.execute("UPDATE MainAdmin SET passwordHash = %s WHERE Admin_ID = %s", (hashed_pw, admin_id))

        # Mark OTP as used
        cur.execute("UPDATE OTP SET Is_Used = TRUE WHERE OTP_ID = %s", (otp_id,))
        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Password reset successful"}), 200

    except Exception as err:
        print(traceback.format_exc())
        return jsonify({"error": str(err)}), 500
