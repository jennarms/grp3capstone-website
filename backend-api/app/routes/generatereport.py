import logging
from flask import Blueprint, request, jsonify
from app import mysql  # assuming mysql is initialized in your app
from datetime import datetime

# Set up logging configuration to show detailed error information
logging.basicConfig(level=logging.DEBUG)

generatereport_bp = Blueprint('generatereport_bp', __name__)

@generatereport_bp.route('/generate_report', methods=['GET'])
def generate_report():
    # Get the start and end date from the query parameters
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not start_date or not end_date:
        logging.error("Both start_date and end_date are required. Provided start_date: %s, end_date: %s", start_date, end_date)
        return jsonify({"error": "Both start_date and end_date are required"}), 400

    try:
        # Validate and parse the start and end dates
        logging.debug("Attempting to parse start_date: %s, end_date: %s", start_date, end_date)
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        logging.debug("Parsed start_date: %s, end_date: %s", start_date, end_date)

    except ValueError as e:
        # Log the error with more detail
        logging.error("Error parsing dates. start_date: %s, end_date: %s. Error: %s", start_date, end_date, str(e))
        return jsonify({"error": f"Invalid date format. Use YYYY-MM-DD. Error: {str(e)}"}), 400

    try:
        # Create the SQL query - removed Peak/Off-Peak columns
        query = """
        SELECT 
    st.StationName,
    COUNT(bd.Booking_ID) AS TotalBookings,
    SUM(CASE WHEN bd.status = 'C' THEN 1 ELSE 0 END) AS CanceledCount,
    SUM(CASE WHEN u.gender = 'F' THEN 1 ELSE 0 END) AS FemaleCount,
    SUM(CASE WHEN u.gender = 'M' THEN 1 ELSE 0 END) AS MaleCount,
    SUM(CASE WHEN u.gender NOT IN ('F', 'M') THEN 1 ELSE 0 END) AS OtherGenderCount,
    SUM(CASE WHEN u.age BETWEEN 0 AND 18 THEN 1 ELSE 0 END) AS Age_0_18,
    SUM(CASE WHEN u.age BETWEEN 19 AND 25 THEN 1 ELSE 0 END) AS Age_19_25,
    SUM(CASE WHEN u.age BETWEEN 26 AND 40 THEN 1 ELSE 0 END) AS Age_26_40,
    SUM(CASE WHEN u.age BETWEEN 41 AND 60 THEN 1 ELSE 0 END) AS Age_41_60,
    SUM(CASE WHEN u.age > 60 THEN 1 ELSE 0 END) AS Age_60Plus,
    SUM(CASE WHEN u.profession LIKE '%%Student%%' THEN 1 ELSE 0 END) AS StudentCount,
    SUM(CASE WHEN u.profession LIKE '%%Senior%%' THEN 1 ELSE 0 END) AS SeniorCount,
    SUM(CASE WHEN u.profession LIKE '%%PWD%%' THEN 1 ELSE 0 END) AS PWDCount,
    SUM(CASE WHEN u.platform_source = 'MA' THEN 1 ELSE 0 END) AS MobileAppCount,
    SUM(CASE WHEN u.platform_source = 'CB' THEN 1 ELSE 0 END) AS ChatbotCount,
    SUM(CASE WHEN u.platform_source = 'EM' THEN 1 ELSE 0 END) AS EmailCount,
    SUM(CASE WHEN u.platform_source = 'MB' THEN 1 ELSE 0 END) AS ManualBookingCount
FROM 
    Station st
LEFT JOIN 
    BoardingDisembarking bd ON st.Station_ID = bd.origin
LEFT JOIN 
    Users u ON bd.User_ID = u.User_ID
WHERE 
    (bd.departure_date BETWEEN %s AND %s OR bd.departure_date IS NULL)
   AND (bd.status IN ('D', 'C', 'P') OR bd.status IS NULL)
GROUP BY 
    st.StationName;
        """

        # Log the query execution with parameters
        logging.debug("Executing SQL query with start_date: %s, end_date: %s", start_date, end_date)

        # Execute the query
        cursor = mysql.connection.cursor()
        cursor.execute(query, (start_date, end_date))
        result = cursor.fetchall()

        # Log the fetched data
        logging.debug("Fetched %d rows from database.", len(result))

        # Format the results into a list of dictionaries - removed Peak/Off-Peak fields
        report = []
        for row in result:
            report.append({
                "StationName": row[0],
                "TotalBookings": row[1],
                "CanceledCount": row[2],
                "FemaleCount": row[3],
                "MaleCount": row[4],
                "OtherGenderCount": row[5],
                "Age_0_18": row[6],
                "Age_19_25": row[7],
                "Age_26_40": row[8],
                "Age_41_60": row[9],
                "Age_60Plus": row[10],
                "StudentCount": row[11],
                "SeniorCount": row[12],
                "PWDCount": row[13],
                "MobileAppCount": row[14],
                "ChatbotCount": row[15],
                "EmailCount": row[16],
                "ManualBookingCount": row[17],
            })

        cursor.close()  # Close the cursor after fetching data
        return jsonify(report)

    except Exception as e:
        logging.error("Error occurred: %s", str(e), exc_info=True)
        return jsonify({"error": f"Internal Server Error: {str(e)}"}), 500