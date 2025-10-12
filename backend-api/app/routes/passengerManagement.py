# passengerManagement.py
from flask import Blueprint, jsonify, request
from app import mysql
from flask_jwt_extended import jwt_required, get_jwt_identity

passenger_bp = Blueprint("passenger_bp", __name__)

# -------------------------
# Utilities
# -------------------------
def get_user_columns():
    cur = mysql.connection.cursor()
    try:
        cur.execute("SHOW COLUMNS FROM Users")
        cols = {row[0] for row in cur.fetchall()}  # column names into a set
        return cols
    finally:
        cur.close()

def first_existing(cols_set, candidates):
    """Return the first column name in candidates that exists in cols_set, else None."""
    for c in candidates:
        if c in cols_set:
            return c
    return None

# -------------------------
# Build a safe SELECT list that never references missing columns
# Returns: (select_list_sql, created_at_src, platform_src, order_by_sql)
# -------------------------
def build_safe_select(cols_set):
    # ID
    user_id_src = first_existing(cols_set, ["User_ID", "user_id", "id"])
    if user_id_src:
        user_id_sql = f"{user_id_src} AS User_ID"
        order_default = f"ORDER BY {user_id_src} DESC"
    else:
        # If even an ID doesn't exist, synthesize a constant (rare)
        user_id_sql = "NULL AS User_ID"
        order_default = ""

    # username: prefer username, else email, else ''
    username_src = first_existing(cols_set, ["username", "user_name"])
    if username_src:
        username_sql = f"{username_src} AS username"
    else:
        email_src = first_existing(cols_set, ["email", "email_address"])
        username_sql = f"{email_src} AS username" if email_src else "'' AS username"

    # names
    first_name_src = first_existing(cols_set, ["first_name", "firstname", "given_name"])
    first_name_sql = f"{first_name_src} AS first_name" if first_name_src else "'' AS first_name"

    last_name_src = first_existing(cols_set, ["last_name", "lastname", "surname", "family_name"])
    last_name_sql = f"{last_name_src} AS last_name" if last_name_src else "'' AS last_name"

    # address / profession (optional)
    address_src = first_existing(cols_set, ["address", "street_address"])
    address_sql = f"{address_src} AS address" if address_src else "'' AS address"

    profession_src = first_existing(cols_set, ["profession", "job_title", "occupation"])
    profession_sql = f"{profession_src} AS profession" if profession_src else "'' AS profession"

    # contact number
    contact_src = first_existing(cols_set, ["contact_number", "phone", "mobile", "phone_number"])
    contact_sql = f"{contact_src} AS contact_number" if contact_src else "'' AS contact_number"

    # birthday + age
    dob_src = first_existing(cols_set, ["date_of_birth", "dob", "birthday"])
    if dob_src:
        birthday_sql = f"{dob_src} AS birthday"
        age_sql = f"TIMESTAMPDIFF(YEAR, {dob_src}, CURDATE()) AS age"
    else:
        birthday_sql = "NULL AS birthday"
        age_sql = "NULL AS age"

    # gender
    gender_src = first_existing(cols_set, ["gender", "sex"])
    gender_sql = f"{gender_src} AS gender" if gender_src else "NULL AS gender"

    # created_at
    created_at_src = first_existing(cols_set, ["created_at", "date_created", "createdAt", "created_on", "registered_at"])
    created_at_sql = f"{created_at_src} AS created_at" if created_at_src else "NULL AS created_at"

    # platform_source
    platform_src = first_existing(cols_set, ["platform_source", "platform", "source_platform"])
    platform_sql = f"{platform_src} AS platform_source" if platform_src else "NULL AS platform_source"
    if platform_src:
        platform_name_sql = (
            "CASE {ps} "
            "  WHEN 'MA' THEN 'Mobile App' "
            "  WHEN 'CB' THEN 'Chatbot' "
            "  WHEN 'EM' THEN 'Email' "
            "  WHEN 'MB' THEN 'Manual' "
            "  ELSE 'Unknown' "
            "END AS platform_name"
        ).format(ps=platform_src)
    else:
        platform_name_sql = "'Unknown' AS platform_name"

    # messenger_psid
    psid_src = first_existing(cols_set, ["messenger_psid", "psid"])
    psid_sql = f"{psid_src} AS messenger_psid" if psid_src else "'' AS messenger_psid"

    # order by: prefer created_at, else id, else nothing
    if created_at_src:
        order_sql = f"ORDER BY {created_at_src} DESC"
    else:
        order_sql = order_default  # may be empty if no id either (very unlikely)

    select_list = ", ".join([
        user_id_sql,
        username_sql,
        first_name_sql,
        last_name_sql,
        address_sql,
        profession_sql,
        contact_sql,
        age_sql,
        birthday_sql,
        gender_sql,
        created_at_sql,
        platform_sql,
        platform_name_sql,
        psid_sql,
    ])

    return select_list, created_at_src, platform_src, order_sql

# -------------------------
# GET /api/users
# -------------------------
@passenger_bp.route("/", methods=["GET"])
def get_passengers():
    platform = request.args.get("platform", None)   # 'MB' | 'CB' | 'EM' | 'MA' | 'all' | None
    date_from = request.args.get("date_from", None) # 'YYYY-MM-DD' (optional)
    date_to   = request.args.get("date_to", None)   # 'YYYY-MM-DD' (optional)

    cols_set = get_user_columns()
    select_list, created_at_src, platform_src, order_sql = build_safe_select(cols_set)

    where_clauses = []
    params = []

    # platform filter only if platform column exists and not 'all'
    if platform and platform.lower() != "all" and platform_src:
        where_clauses.append(f"{platform_src} = %s")
        params.append(platform)

    # date range filter only if we have a created_at source column
    if created_at_src:
        if date_from:
            where_clauses.append(f"DATE({created_at_src}) >= %s")
            params.append(date_from)
        if date_to:
            where_clauses.append(f"DATE({created_at_src}) <= %s")
            params.append(date_to)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    base_sql = f"SELECT {select_list} FROM Users {where_sql} {order_sql}".strip()

    cur = mysql.connection.cursor()
    try:
        cur.execute(base_sql, tuple(params))
        users = cur.fetchall()  # list of tuples (matches the fixed order expected by the UI)
        return jsonify(users), 200
    finally:
        cur.close()

# -------------------------
# DELETE /api/users/<user_id>
# -------------------------
@passenger_bp.route("/<user_id>", methods=["DELETE"])
def delete_passenger(user_id):
    cur = mysql.connection.cursor()
    try:
        cur.execute("DELETE FROM Users WHERE User_ID = %s", (user_id,))
        mysql.connection.commit()
        return jsonify({"message": f"User {user_id} deleted successfully."}), 200
    except Exception as e:
        # Error handling
        return jsonify({"message": f"Error deleting user {user_id}: {str(e)}"}), 500
    finally:
        cur.close()
