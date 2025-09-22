from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import mysql
from datetime import datetime

ui_bp = Blueprint("ui_bp", __name__, url_prefix="/api/ui")

# -------------------------------
# GET customization (for current company)
# -------------------------------
@ui_bp.route("/<company_id>", methods=["GET"])
@jwt_required()
def get_ui_customization(company_id):
    print(f"Requested company_id: {company_id}")  # Debug line
    print(f"JWT Identity: {get_jwt_identity()}")   # Debug line
    
    cur = mysql.connection.cursor()
    
    # Debug: Check what companies exist
    cur.execute("SELECT Company_ID FROM Transport_Provider")
    all_companies = cur.fetchall()
    print(f"Available companies: {[company[0] for company in all_companies]}")  # Debug line
    
    cur.execute(
        """
        SELECT Company_ID, companyName, logo, firstColor, secondColor, date_configured
        FROM Transport_Provider
        WHERE Company_ID = %s
        """,
        (company_id,),
    )
    row = cur.fetchone()
    print(f"Query result: {row}")  # Debug line
    cur.close()

    if not row:
        return jsonify({
            "msg": f"Company not found for ID: {company_id}",
            "available_companies": [company[0] for company in all_companies]
        }), 404

    return jsonify(
        {
            "Company_ID": row[0],
            "companyName": row[1],
            "logo": row[2],
            "firstColor": row[3],
            "secondColor": row[4],
            "date_configured": row[5].strftime("%Y-%m-%d %H:%M:%S") if row[5] else None,
        }
    )


# -------------------------------
# UPDATE customization (logo, colors, name)
# -------------------------------
@ui_bp.route("/<company_id>", methods=["PUT"])
@jwt_required()
def update_ui_customization(company_id):
    print(f"Updating company_id: {company_id}")  # Debug line
    
    data = request.get_json()
    companyName = data.get("companyName")
    logo = data.get("logo")
    firstColor = data.get("firstColor")
    secondColor = data.get("secondColor")
    
    print(f"Update data: {data}")  # Debug line

    cur = mysql.connection.cursor()
    
    # Check if company exists first
    cur.execute("SELECT Company_ID FROM Transport_Provider WHERE Company_ID = %s", (company_id,))
    existing = cur.fetchone()
    
    if not existing:
        cur.close()
        return jsonify({"msg": f"Company not found for ID: {company_id}"}), 404
    
    # Update the company
    cur.execute(
        """
        UPDATE Transport_Provider
        SET companyName = %s,
            logo = %s,
            firstColor = %s,
            secondColor = %s,
            date_configured = %s
        WHERE Company_ID = %s
        """,
        (companyName, logo, firstColor, secondColor, datetime.now(), company_id),
    )
    
    affected_rows = cur.rowcount
    mysql.connection.commit()
    cur.close()
    
    print(f"Updated rows: {affected_rows}")  # Debug line

    return jsonify({
        "msg": "UI customization updated successfully",
        "company_id": company_id,
        "affected_rows": affected_rows
    })


# -------------------------------
# GET all companies (for debugging)
# -------------------------------
@ui_bp.route("/", methods=["GET"])
@jwt_required()
def get_all_companies():
    cur = mysql.connection.cursor()
    cur.execute("SELECT Company_ID, companyName FROM Transport_Provider")
    companies = cur.fetchall()
    cur.close()
    
    return jsonify({
        "companies": [{"id": company[0], "name": company[1]} for company in companies]
    })


# -------------------------------
# NEW: Get company_id for current logged-in user
# -------------------------------
@ui_bp.route("/get-company-id", methods=["GET"])
@jwt_required()
def get_company_id():
    current_user = get_jwt_identity()  # This is whatever you set in create_access_token()

    print(f"Fetching company ID for user: {current_user}")  # Debug

    cur = mysql.connection.cursor()
    
    # ⚠️ Adjust table/column names if different
    cur.execute("SELECT Company_ID FROM Users WHERE User_ID = %s", (current_user,))
    result = cur.fetchone()
    cur.close()

    if not result:
        return jsonify({"msg": "Company not found for this user"}), 404

    return jsonify({"companyId": result[0]}), 200
