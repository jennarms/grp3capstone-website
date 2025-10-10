from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import mysql, mail
from flask_mail import Message
import random, string, datetime, uuid, re, os
import bcrypt

station_bp = Blueprint("station", __name__, url_prefix="/api/station")

# ------------------------
# Utils
# ------------------------
def generate_otp(length=6):
    return ''.join(random.choices(string.digits, k=length))

def save_otp(user_type, admin_id, station_id=None):
    otp_code = generate_otp()
    otp_id = str(uuid.uuid4())
    expiration = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)

    cur = mysql.connection.cursor()
    cur.execute("""
        INSERT INTO OTP_Admin (OTP_ID, User_Type, Admin_ID, Station_ID, OTP_Code, Expiration)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (otp_id, user_type, admin_id, station_id, otp_code, expiration))
    mysql.connection.commit()
    cur.close()
    return otp_code

def send_email(to_email, subject, body):
    msg = Message(subject, sender=os.getenv("MAIL_DEFAULT_SENDER"), recipients=[to_email])
    msg.body = body
    mail.send(msg)

def verify_otp(otp_code, station_id=None):
    cur = mysql.connection.cursor()
    if station_id:
        cur.execute("""
            SELECT OTP_ID, OTP_Code, Expiration, Is_Used
            FROM OTP_Admin
            WHERE Station_ID=%s AND OTP_Code=%s
            ORDER BY Created_At DESC
            LIMIT 1
        """, (station_id, otp_code))
    else:
        cur.execute("""
            SELECT OTP_ID, OTP_Code, Expiration, Is_Used
            FROM OTP_Admin
            WHERE OTP_Code=%s
            ORDER BY Created_At DESC
            LIMIT 1
        """, (otp_code,))
    otp_row = cur.fetchone()
    cur.close()

    if not otp_row:
        return False, "Invalid OTP", None

    otp_id, code, exp, used = otp_row
    if used:
        return False, "OTP already used", None
    if datetime.datetime.utcnow() > exp:
        return False, "OTP expired", None
    return True, None, otp_id

def mark_otp_used(otp_id):
    cur = mysql.connection.cursor()
    cur.execute("UPDATE OTP_Admin SET Is_Used=TRUE WHERE OTP_ID=%s", (otp_id,))
    mysql.connection.commit()
    cur.close()

def validate_password(password):
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number."
    if not re.search(r"[@$!%*?&]", password):
        return False, "Password must contain at least one special character (@$!%*?&)."
    return True, None

def generate_station_id():
    cur = mysql.connection.cursor()
    cur.execute("SELECT Station_ID FROM Station WHERE Station_ID REGEXP '^ST[0-9]+$' ORDER BY Station_ID DESC LIMIT 1")
    last_id = cur.fetchone()
    cur.close()

    if last_id:
        last_num = int(last_id[0][2:])
        new_num = last_num + 1
    else:
        new_num = 1

    return f"ST{new_num:04d}"

# ==================================================
# VIEW
# ==================================================
@station_bp.route("/", methods=["GET"])
@jwt_required()
def get_stations():
    cur = mysql.connection.cursor()
    cur.execute("SELECT Station_ID, Company_ID, StationName, email, username, lat, lon FROM Station")
    rows = cur.fetchall()
    cur.close()

    stations = [{
        "stationId": r[0],
        "companyId": r[1],
        "stationName": r[2],
        "email": r[3],
        "username": r[4],
        "lat": r[5],
        "lon": r[6]
    } for r in rows]

    return jsonify(stations), 200

# ==================================================
# ADD
# ==================================================
@station_bp.route("/request-add", methods=["POST"])
@jwt_required()
def request_add_station():
    data = request.get_json()
    admin_id = get_jwt_identity()
    otp_code = save_otp("main-admin", admin_id)
    send_email(data["email"], "OTP for Station Creation", f"Your OTP is {otp_code}.")
    return jsonify({"message": "OTP sent to admin"}), 200

@station_bp.route("/confirm-add", methods=["POST"])
@jwt_required()
def confirm_add_station():
    data = request.get_json()
    otp_code, details = data.get("otpCode"), data.get("details")

    valid, error, otp_id = verify_otp(otp_code)
    if not valid:
        return jsonify({"error": error}), 400

    # ✅ Validate password
    is_valid, msg = validate_password(details["password"])
    if not is_valid:
        return jsonify({"error": msg}), 400
    hashed_pw = bcrypt.hashpw(details["password"].encode("utf-8"), bcrypt.gensalt())
    station_id = generate_station_id()

    cur = mysql.connection.cursor()

    # ✅ Check if email already exists
    cur.execute("SELECT Station_ID FROM Station WHERE email=%s", (details["email"],))
    if cur.fetchone():
        cur.close()
        return jsonify({"error": "Email already exists for another station"}), 400

    # ✅ Get company_id (ensure there's a company in the DB)
    cur.execute("SELECT Company_ID FROM Transport_Provider LIMIT 1")
    company_row = cur.fetchone()
    if not company_row:
        cur.close()
        return jsonify({"error": "No company found in DB"}), 400
    company_id = company_row[0]

    # ✅ Insert the station with lat and lon
    cur.execute("""
        INSERT INTO Station (Station_ID, Company_ID, StationName, email, username, password, lat, lon)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        station_id,
        company_id,
        details["stationName"],
        details["email"],
        details["username"],
        hashed_pw,
        details["lat"],  # Add latitude
        details["lon"]   # Add longitude
    ))
    mysql.connection.commit()
    cur.close()

    mark_otp_used(otp_id)
    return jsonify({"message": "Station created successfully", "stationId": station_id}), 201

# ==================================================
# UPDATE
# ==================================================
@station_bp.route("/request-update/<station_id>", methods=["POST"])
@jwt_required()
def request_update_station(station_id):
    data = request.get_json()
    new_email = data.get("email")

    if not new_email:
        return jsonify({"error": "New email is required"}), 400

    admin_id = get_jwt_identity()
    otp_code = save_otp("main-admin", admin_id, station_id)
    send_email(new_email, "OTP for Station Email Update", f"Your OTP is {otp_code}.")
    return jsonify({"message": "OTP sent to new email"}), 200

@station_bp.route("/update/<station_id>", methods=["POST"])
@jwt_required()
def update_station(station_id):
    data = request.get_json()
    otp_code = data.get("otpCode")
    details = data.get("details")

    cur = mysql.connection.cursor()
    cur.execute("SELECT email FROM Station WHERE Station_ID=%s", (station_id,))
    row = cur.fetchone()
    if not row:
        cur.close()
        return jsonify({"error": "Station not found"}), 404
    current_email = row[0]

    otp_id = None
    if details.get("email") and details["email"] != current_email:
        # ✅ Prevent duplicate email
        cur.execute("SELECT Station_ID FROM Station WHERE email=%s", (details["email"],))
        existing = cur.fetchone()
        if existing and existing[0] != station_id:
            cur.close()
            return jsonify({"error": "Email already exists for another station"}), 400

        if not otp_code:
            cur.close()
            return jsonify({"error": "OTP required to change email"}), 400
        valid, error, otp_id = verify_otp(otp_code, station_id)
        if not valid:
            cur.close()
            return jsonify({"error": error}), 400

    # ✅ Build dynamic update query for fields
    fields, values = [], []

    if details.get("stationName"):
        fields.append("StationName=%s")
        values.append(details["stationName"])

    if details.get("email"):
        fields.append("email=%s")
        values.append(details["email"])

    if details.get("username"):
        fields.append("username=%s")
        values.append(details["username"])

    if details.get("password"):
        is_valid, msg = validate_password(details["password"])
        if not is_valid:
            cur.close()
            return jsonify({"error": msg}), 400
        hashed_pw = bcrypt.hashpw(details["password"].encode("utf-8"), bcrypt.gensalt())
        fields.append("password=%s")
        values.append(hashed_pw)

    if details.get("lat"):
        fields.append("lat=%s")
        values.append(details["lat"])

    if details.get("lon"):
        fields.append("lon=%s")
        values.append(details["lon"])

    if not fields:
        cur.close()
        return jsonify({"error": "No fields provided for update"}), 400

    values.append(station_id)
    cur.execute(f"UPDATE Station SET {', '.join(fields)} WHERE Station_ID=%s", values)
    mysql.connection.commit()
    cur.close()

    if otp_id:
        mark_otp_used(otp_id)

    return jsonify({"message": "Station updated successfully"}), 200

# ==================================================
# DELETE
# ==================================================
@station_bp.route("/request-delete/<station_id>", methods=["POST"])
@jwt_required()
def request_delete_station(station_id):
    cur = mysql.connection.cursor()
    cur.execute("SELECT email FROM Station WHERE Station_ID=%s", (station_id,))
    row = cur.fetchone()
    if not row:
        cur.close()
        return jsonify({"error": "Station not found"}), 404

    email = row[0]
    admin_id = get_jwt_identity()
    otp_code = save_otp("main-admin", admin_id, station_id)
    send_email(email, "OTP for Station Deletion", f"Your OTP is {otp_code}.")
    cur.close()

    return jsonify({"message": "OTP sent for deletion"}), 200

@station_bp.route("/confirm-delete/<station_id>", methods=["POST"])
@jwt_required()
def confirm_delete_station(station_id):
    try:
        data = request.get_json()
        admin_password = data.get("adminPassword")
        admin_id = get_jwt_identity()

        if not admin_password:
            return jsonify({"error": "Admin password is required"}), 400

        cur = mysql.connection.cursor()
        cur.execute("SELECT passwordHash FROM MainAdmin WHERE Admin_ID=%s", (admin_id,))
        row = cur.fetchone()

        if not row:
            cur.close()
            return jsonify({"error": "Admin not found"}), 404

        stored_hash = row[0].encode('utf-8')
        if not bcrypt.checkpw(admin_password.encode('utf-8'), stored_hash):
            cur.close()
            return jsonify({"error": "Invalid admin password"}), 401

        cur.execute("DELETE FROM Station WHERE Station_ID=%s", (station_id,))
        mysql.connection.commit()
        cur.close()

        return jsonify({"message": f"Station {station_id} successfully deleted"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
