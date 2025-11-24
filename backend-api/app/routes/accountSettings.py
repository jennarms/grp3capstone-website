# app/routes/accountSettings.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import mysql
from app.brevo_email import send_email
import bcrypt
import random
import string
from datetime import datetime, timedelta
import traceback
import re

account_settings_bp = Blueprint("account_settings", __name__)


# Helper: Generate OTP
def generate_otp(length=6):
    return ''.join(random.choices(string.digits, k=length))


# =====================
# GET ACCOUNT DETAILS (username + email)
# =====================
@account_settings_bp.route("/get-details", methods=["GET"])
@jwt_required()
def get_account_details():
    user_id = get_jwt_identity()
    claims = get_jwt()
    role = claims.get("role")

    try:
        cur = mysql.connection.cursor()

        if role == "main-admin":
            cur.execute("SELECT username, email FROM MainAdmin WHERE Admin_ID = %s", (user_id,))
        else:
            cur.execute("SELECT username, email FROM Station WHERE Station_ID = %s", (user_id,))

        account = cur.fetchone()
        cur.close()

        if not account:
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            "username": account[0],
            "email": account[1]
        }), 200

    except Exception as err:
        print(traceback.format_exc())
        return jsonify({"error": str(err)}), 500


# =====================
# REQUEST EMAIL CHANGE (send OTP)
# =====================
@account_settings_bp.route("/request-email-change", methods=["POST"])
@jwt_required()
def request_email_change():
    user_id = get_jwt_identity()
    claims = get_jwt()
    role = claims.get("role")

    data = request.get_json()
    new_email = data.get("new_email")

    if not new_email:
        return jsonify({"error": "New email is required"}), 400

    try:
        cur = mysql.connection.cursor()

        # Get current email
        if role == "main-admin":
            cur.execute("SELECT email FROM MainAdmin WHERE Admin_ID = %s", (user_id,))
        else:
            cur.execute("SELECT email FROM Station WHERE Station_ID = %s", (user_id,))
        account = cur.fetchone()

        if not account:
            return jsonify({"error": "User not found"}), 404

        # Generate OTP
        otp_code = generate_otp()
        expiration = datetime.utcnow() + timedelta(minutes=10)

        cur.execute("""
            INSERT INTO OTP_Admin (OTP_ID, User_Type, Admin_ID, Station_ID, OTP_Code, Expiration, Is_Used, Created_At)
            VALUES (UUID(), %s, %s, %s, %s, %s, FALSE, NOW())
        """, (
            role,
            user_id if role == "main-admin" else None,
            user_id if role == "station" else None,
            otp_code,
            expiration,
        ))

        mysql.connection.commit()
        cur.close()

        # Send OTP email via Brevo API
        send_email(
            to_email=new_email,
            subject="Email Change OTP",
            text_body=f"Your OTP to change email is {otp_code}. It will expire in 10 minutes.",
        )

        return jsonify({"message": f"OTP sent to {new_email}. Please verify to update email."}), 200

    except Exception as err:
        print(traceback.format_exc())
        return jsonify({"error": str(err)}), 500


# =====================
# CONFIRM EMAIL CHANGE
# =====================
@account_settings_bp.route("/confirm-email-change", methods=["POST"])
@jwt_required()
def confirm_email_change():
    user_id = get_jwt_identity()
    claims = get_jwt()
    role = claims.get("role")

    data = request.get_json()
    otp_code = data.get("otp_code")
    new_email = data.get("new_email")

    if not otp_code or not new_email:
        return jsonify({"error": "OTP and new email are required"}), 400

    try:
        cur = mysql.connection.cursor()
        cur.execute("""
            SELECT OTP_ID, Expiration, Is_Used
            FROM OTP_Admin
            WHERE OTP_Code = %s AND User_Type = %s
            ORDER BY Created_At DESC LIMIT 1
        """, (otp_code, role))
        otp_record = cur.fetchone()

        if not otp_record:
            return jsonify({"error": "Invalid OTP"}), 400

        otp_id, expiration, is_used = otp_record
        if is_used:
            return jsonify({"error": "OTP already used"}), 400
        if datetime.utcnow() > expiration:
            return jsonify({"error": "OTP expired"}), 400

        # Update email
        if role == "main-admin":
            cur.execute("UPDATE MainAdmin SET email = %s WHERE Admin_ID = %s", (new_email, user_id))
        else:
            cur.execute("UPDATE Station SET email = %s WHERE Station_ID = %s", (new_email, user_id))

        cur.execute("UPDATE OTP_Admin SET Is_Used = TRUE WHERE OTP_ID = %s", (otp_id,))
        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Email updated successfully"}), 200

    except Exception as err:
        print(traceback.format_exc())
        return jsonify({"error": str(err)}), 500


# =====================
# UPDATE USERNAME (requires password check)
# =====================
@account_settings_bp.route("/update-username", methods=["POST"])
@jwt_required()
def update_username():
    user_id = get_jwt_identity()
    claims = get_jwt()
    role = claims.get("role")

    data = request.get_json()
    new_username = data.get("new_username")
    password = data.get("password")

    if not new_username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    try:
        cur = mysql.connection.cursor()
        if role == "main-admin":
            cur.execute("SELECT passwordHash FROM MainAdmin WHERE Admin_ID = %s", (user_id,))
        else:
            cur.execute("SELECT password FROM Station WHERE Station_ID = %s", (user_id,))
        account = cur.fetchone()

        if not account:
            return jsonify({"error": "User not found"}), 404

        stored_hash = account[0].encode("utf-8")
        if not bcrypt.checkpw(password.encode("utf-8"), stored_hash):
            return jsonify({"error": "Incorrect password"}), 401

        if role == "main-admin":
            cur.execute("UPDATE MainAdmin SET username = %s WHERE Admin_ID = %s", (new_username, user_id))
        else:
            cur.execute("UPDATE Station SET username = %s WHERE Station_ID = %s", (new_username, user_id))

        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Username updated successfully"}), 200

    except Exception as err:
        print(traceback.format_exc())
        return jsonify({"error": str(err)}), 500


# =====================
# UPDATE PASSWORD (with confirm + strength rules)
# =====================
@account_settings_bp.route("/update-password", methods=["POST"])
@jwt_required()
def update_password():
    user_id = get_jwt_identity()
    claims = get_jwt()
    role = claims.get("role")

    data = request.get_json()
    current_pw = data.get("current_password")
    new_pw = data.get("new_password")
    confirm_pw = data.get("confirm_password")

    # ✅ Required fields
    if not current_pw or not new_pw or not confirm_pw:
        return jsonify({"error": "Current, new, and confirm password are required"}), 400

    # ✅ Check confirm password
    if new_pw != confirm_pw:
        return jsonify({"error": "New password and confirm password do not match"}), 400

    # ✅ Password strength validation
    if len(new_pw) < 8:
        return jsonify({"error": "Password must be at least 8 characters long"}), 400
    if not re.search(r"[A-Z]", new_pw):
        return jsonify({"error": "Password must contain at least one uppercase letter"}), 400
    if not re.search(r"[a-z]", new_pw):
        return jsonify({"error": "Password must contain at least one lowercase letter"}), 400
    if not re.search(r"\d", new_pw):
        return jsonify({"error": "Password must contain at least one number"}), 400
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", new_pw):
        return jsonify({"error": "Password must contain at least one special character"}), 400

    try:
        cur = mysql.connection.cursor()

        # ✅ Fetch current stored hash
        if role == "main-admin":
            cur.execute("SELECT passwordHash FROM MainAdmin WHERE Admin_ID = %s", (user_id,))
        else:
            cur.execute("SELECT password FROM Station WHERE Station_ID = %s", (user_id,))
        account = cur.fetchone()

        if not account:
            return jsonify({"error": "User not found"}), 404

        stored_hash = account[0].encode("utf-8")

        # ✅ Verify current password
        if not bcrypt.checkpw(current_pw.encode("utf-8"), stored_hash):
            return jsonify({"error": "Current password incorrect"}), 401

        # ✅ Prevent using the same password again
        if bcrypt.checkpw(new_pw.encode("utf-8"), stored_hash):
            return jsonify({"error": "New password cannot be the same as the current password"}), 400

        # ✅ Hash new password
        hashed_pw = bcrypt.hashpw(new_pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        # ✅ Update password in DB
        if role == "main-admin":
            cur.execute("UPDATE MainAdmin SET passwordHash = %s WHERE Admin_ID = %s", (hashed_pw, user_id))
        else:
            cur.execute("UPDATE Station SET password = %s WHERE Station_ID = %s", (hashed_pw, user_id))

        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Password updated successfully"}), 200

    except Exception as err:
        print(traceback.format_exc())
        return jsonify({"error": str(err)}), 500
