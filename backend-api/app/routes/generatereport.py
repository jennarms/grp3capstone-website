import logging
from flask import Blueprint, request, jsonify
from app import mysql  # assuming mysql is initialized in your app
from datetime import datetime

# Set up logging configuration to show detailed error information
logging.basicConfig(level=logging.DEBUG)

generatereport_bp = Blueprint('generatereport_bp', __name__)

# ==============================
# Total Report
# ==============================

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
    
# ==============================
# Peak Report
# ==============================

@generatereport_bp.route('/generate_peak_report', methods=['GET'])
def generate_peak_report():
    # Get the start and end date from the query parameters
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not start_date or not end_date:
        logging.error(
            "Both start_date and end_date are required. Provided start_date: %s, end_date: %s",
            start_date, end_date
        )
        return jsonify({"error": "Both start_date and end_date are required"}), 400

    try:
        logging.debug("Attempting to parse start_date: %s, end_date: %s", start_date, end_date)
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        logging.debug("Parsed start_date: %s, end_date: %s", start_date, end_date)
    except ValueError as e:
        logging.error(
            "Error parsing dates. start_date: %s, end_date: %s. Error: %s",
            start_date, end_date, str(e)
        )
        return jsonify({"error": f"Invalid date format. Use YYYY-MM-DD. Error: {str(e)}"}), 400

    try:
        cursor = mysql.connection.cursor()

        # =========================
        # GLOBAL – BY DAY OF WEEK
        # =========================
        global_day_query = """
            SELECT 
                DAYOFWEEK(bd.departure_date) AS day_of_week,
                DATE_FORMAT(bd.departure_date, '%%W') AS day_name,
                COUNT(*) AS total
            FROM BoardingDisembarking bd
            WHERE bd.departure_date IS NOT NULL
              AND bd.departure_date BETWEEN %s AND %s
              AND bd.status IN ('D', 'C', 'P')
            GROUP BY day_of_week, day_name
            ORDER BY day_of_week;
        """
        cursor.execute(global_day_query, (start_date, end_date))
        global_day_rows = cursor.fetchall()

        global_by_day = []
        for row in global_day_rows:
            global_by_day.append({
                "day_of_week": row[0],   # 1 = Sunday, 2 = Monday, ...
                "day_name": row[1],
                "total": row[2],
            })

        # =========================
        # GLOBAL – BY HOUR
        # =========================
        global_hour_query = """
            SELECT 
                HOUR(bd.departure_time) AS hour,
                COUNT(*) AS total
            FROM BoardingDisembarking bd
            WHERE bd.departure_date IS NOT NULL
              AND bd.departure_time IS NOT NULL
              AND bd.departure_date BETWEEN %s AND %s
              AND bd.status IN ('D', 'C', 'P')
            GROUP BY hour
            ORDER BY hour;
        """
        cursor.execute(global_hour_query, (start_date, end_date))
        global_hour_rows = cursor.fetchall()

        global_by_hour = []
        for row in global_hour_rows:
            hour = row[0]
            label = f"{hour:02d}:00"
            global_by_hour.append({
                "hour": hour,
                "label": label,
                "total": row[1],
            })

        # =========================
        # PER STATION – BY DAY
        # =========================
        per_station_day_query = """
            SELECT 
                st.StationName,
                DAYOFWEEK(bd.departure_date) AS day_of_week,
                DATE_FORMAT(bd.departure_date, '%%W') AS day_name,
                COUNT(*) AS total
            FROM Station st
            LEFT JOIN BoardingDisembarking bd 
                ON st.Station_ID = bd.origin
            WHERE bd.departure_date IS NOT NULL
              AND bd.departure_date BETWEEN %s AND %s
              AND bd.status IN ('D', 'C', 'P')
            GROUP BY st.StationName, day_of_week, day_name
            ORDER BY st.StationName, day_of_week;
        """
        cursor.execute(per_station_day_query, (start_date, end_date))
        per_station_day_rows = cursor.fetchall()

        # =========================
        # PER STATION – BY HOUR
        # =========================
        per_station_hour_query = """
            SELECT 
                st.StationName,
                HOUR(bd.departure_time) AS hour,
                COUNT(*) AS total
            FROM Station st
            LEFT JOIN BoardingDisembarking bd 
                ON st.Station_ID = bd.origin
            WHERE bd.departure_date IS NOT NULL
              AND bd.departure_time IS NOT NULL
              AND bd.departure_date BETWEEN %s AND %s
              AND bd.status IN ('D', 'C', 'P')
            GROUP BY st.StationName, hour
            ORDER BY st.StationName, hour;
        """
        cursor.execute(per_station_hour_query, (start_date, end_date))
        per_station_hour_rows = cursor.fetchall()

        cursor.close()

        # =========================
        # HELPER: COMPUTE PEAK / OFF-PEAK
        # =========================
        def compute_peak_off(list_dict, value_key="total"):
            if not list_dict:
                return {"item": None, "peak": None, "off_peak": None}
            peak_item = max(list_dict, key=lambda x: x[value_key])
            off_item = min(list_dict, key=lambda x: x[value_key])
            return {"peak": peak_item, "off_peak": off_item}

        # GLOBAL PEAK / OFF-PEAK
        global_day_peaks = compute_peak_off(global_by_day)
        global_hour_peaks = compute_peak_off(global_by_hour)

        # BUILD PER-STATION STRUCTURE
        stations_map = {}

        for row in per_station_day_rows:
            station_name, day_of_week, day_name, total = row
            if station_name not in stations_map:
                stations_map[station_name] = {
                    "StationName": station_name,
                    "byDay": [],
                    "byHour": []
                }
            stations_map[station_name]["byDay"].append({
                "day_of_week": day_of_week,
                "day_name": day_name,
                "total": total
            })

        for row in per_station_hour_rows:
            station_name, hour, total = row
            if station_name not in stations_map:
                stations_map[station_name] = {
                    "StationName": station_name,
                    "byDay": [],
                    "byHour": []
                }
            stations_map[station_name]["byHour"].append({
                "hour": hour,
                "label": f"{hour:02d}:00",
                "total": total
            })

        # COMPUTE PEAKS PER STATION
        per_station_list = []
        for station_name, data in stations_map.items():
            day_peaks = compute_peak_off(data["byDay"])
            hour_peaks = compute_peak_off(data["byHour"])

            per_station_list.append({
                "StationName": station_name,
                "byDay": data["byDay"],
                "byHour": data["byHour"],
                "peakDay": day_peaks["peak"],
                "offPeakDay": day_peaks["off_peak"],
                "peakHour": hour_peaks["peak"],
                "offPeakHour": hour_peaks["off_peak"],
            })

        response = {
            "start_date": str(start_date),
            "end_date": str(end_date),
            "global": {
                "byDay": global_by_day,
                "byHour": global_by_hour,
                "peakDay": global_day_peaks["peak"],
                "offPeakDay": global_day_peaks["off_peak"],
                "peakHour": global_hour_peaks["peak"],
                "offPeakHour": global_hour_peaks["off_peak"],
            },
            "perStation": per_station_list
        }

        logging.debug("Peak report generated successfully.")
        return jsonify(response)

    except Exception as e:
        logging.error("Error occurred in generate_peak_report: %s", str(e), exc_info=True)
        return jsonify({"error": f"Internal Server Error: {str(e)}"}), 500