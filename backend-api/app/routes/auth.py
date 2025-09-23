from flask import Blueprint, request, jsonify
from app import mysql, mail, jwt
import bcrypt
import random
import string
from datetime import datetime, timedelta
from flask_mail import Message
from flask_jwt_extended import create_access_token
import traceback
import re

auth = Blueprint('auth', __name__)

# Helper function to generate OTP
def generate_otp(length=6):
    return ''.join(random.choices(string.digits, k=length))

# =====================
# LOGIN (MainAdmin + Station)
# =====================
@auth.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username_or_email = data.get('username')
    password = data.get('password')

    if not username_or_email or not password:
        return jsonify({"error": "Missing username/email or password"}), 400

    try:
        cur = mysql.connection.cursor()

        # Check MainAdmin
        cur.execute("""
            SELECT Admin_ID, username, passwordHash, 'main-admin' as role
            FROM MainAdmin
            WHERE username = %s OR email = %s
        """, (username_or_email, username_or_email))
        account = cur.fetchone()

        # If not MainAdmin, check Station
        if not account:
            cur.execute("""
                SELECT Station_ID, username, password, 'station-admin' as role
                FROM Station
                WHERE username = %s OR email = %s
            """, (username_or_email, username_or_email))
            account = cur.fetchone()

        if not account:
            cur.close()
            return jsonify({"error": "Invalid username/email or password"}), 401

        # Unpack values
        user_id = account[0]
        username = account[1]  # <-- fetch username directly
        stored_hash = account[2].encode('utf-8')
        role = account[3]

        if bcrypt.checkpw(password.encode('utf-8'), stored_hash):
            # Create JWT token
            token = create_access_token(
                identity=str(user_id),
                additional_claims={"role": role},
            )

            cur.close()
            return jsonify({
                "message": "Login successful!",
                "role": role,
                "admin_id": user_id,
                "username": username,  # <-- now returned correctly
                "token": token
            }), 200
        else:
            cur.close()
            return jsonify({"error": "Invalid username/email or password"}), 401

    except Exception as err:
        print(traceback.format_exc())
        return jsonify({"error": str(err)}), 500


# =====================
# FORGOT PASSWORD - SEND OTP (Admin)
# =====================
@auth.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    username = data.get('username')

    if not username:
        return jsonify({"error": "Username is required"}), 400

    try:
        cur = mysql.connection.cursor()

        # Check MainAdmin first
        cur.execute("SELECT Admin_ID, email, 'main-admin' as role FROM MainAdmin WHERE username = %s", (username,))
        account = cur.fetchone()

        # Then check Station
        if not account:
            cur.execute("SELECT Station_ID, email, 'station-admin' as role FROM Station WHERE username = %s", (username,))
            account = cur.fetchone()

        if not account:
            return jsonify({"error": "Username not found"}), 404

        user_id, email, role = account
        otp_code = generate_otp()
        expiration = datetime.utcnow() + timedelta(minutes=10)

        # Insert into OTP_Admin table
        if role == 'main-admin':
            cur.execute("""
                INSERT INTO OTP_Admin (OTP_ID, User_Type, Admin_ID, OTP_Code, Expiration, Is_Used, Created_At)
                VALUES (UUID(), %s, %s, %s, %s, FALSE, NOW())
            """, (role, user_id, otp_code, expiration))
        else:  # station-admin
            cur.execute("""
                INSERT INTO OTP_Admin (OTP_ID, User_Type, Station_ID, OTP_Code, Expiration, Is_Used, Created_At)
                VALUES (UUID(), %s, %s, %s, %s, FALSE, NOW())
            """, (role, user_id, otp_code, expiration))

        mysql.connection.commit()
        cur.close()

        # Send OTP email
        msg = Message("Password Reset OTP", sender="noreply@example.com", recipients=[email])
        msg.body = f"Your OTP code is {otp_code}. It will expire in 10 minutes."
        mail.send(msg)

        return jsonify({"message": f"OTP sent to email linked to {role}"}), 200

    except Exception as err:
        print(traceback.format_exc())
        return jsonify({"error": str(err)}), 500

# Helper: validate password strength
def is_strong_password(password):
    if len(password) < 8:
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"[a-z]", password):
        return False
    if not re.search(r"[0-9]", password):
        return False
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False
    return True


# =====================
# RESET PASSWORD (Admin)
# =====================
@auth.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    username = data.get('username')
    otp_code = data.get('otp')
    new_password = data.get('new_password')
    confirm_password = data.get('confirm_password')

    if not username or not otp_code or not new_password or not confirm_password:
        return jsonify({"error": "All fields are required"}), 400
    if new_password != confirm_password:
        return jsonify({"error": "Passwords do not match"}), 400
    if not is_strong_password(new_password):
        return jsonify({"error": "Password must be at least 8 characters long, "
                                 "contain uppercase, lowercase, number, and special character"}), 400

    try:
        cur = mysql.connection.cursor()

        # Find OTP in OTP_Admin
        cur.execute("""
            SELECT OTP_ID, Expiration, Is_Used, User_Type, Admin_ID, Station_ID
            FROM OTP_Admin
            WHERE OTP_Code = %s
            ORDER BY Created_At DESC LIMIT 1
        """, (otp_code,))
        otp_record = cur.fetchone()

        if not otp_record:
            return jsonify({"error": "Invalid OTP"}), 400

        otp_id, expiration, is_used, role, admin_id, station_id = otp_record

        if is_used:
            return jsonify({"error": "OTP already used"}), 400
        if datetime.utcnow() > expiration:
            return jsonify({"error": "OTP expired"}), 400

        hashed_pw = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Update password
        if role == 'main-admin':
            cur.execute("UPDATE MainAdmin SET passwordHash = %s WHERE Admin_ID = %s", (hashed_pw, admin_id))
        else:
            cur.execute("UPDATE Station SET password = %s WHERE Station_ID = %s", (hashed_pw, station_id))

        # Mark OTP as used
        cur.execute("UPDATE OTP_Admin SET Is_Used = TRUE WHERE OTP_ID = %s", (otp_id,))
        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Password reset successful"}), 200

    except Exception as err:
        print(traceback.format_exc())
        return jsonify({"error": str(err)}), 500