from flask import Blueprint, request, jsonify
from app import mysql
from datetime import datetime

boarding_passengertable_bp = Blueprint('boarding_passengertable_bp', __name__)

# Fetch all bookings that are not yet in BoardingDisembarking (including old and new)
@boarding_passengertable_bp.route('/fetch_and_insert_bookings', methods=['GET'])
def fetch_and_insert_bookings():
    station_id = request.args.get('station_id')  # Get station ID from query params
    schedule_id = request.args.get('schedule_id')  # Get schedule ID from query params
    cursor = mysql.connection.cursor()

    try:
        # Query to fetch all bookings that are not already in BoardingDisembarking
        query = """
            SELECT
                Booking_ID,
                User_ID,
                Qrcode_ID,
                origin,
                destination,
                departure_date,
                departure_time,
                Schedule_ID,
                Station_ID
            FROM Booking
            WHERE Booking_ID NOT IN (SELECT Booking_ID FROM BoardingDisembarking)
        """
        cursor.execute(query)
        bookings = cursor.fetchall()

        if bookings:
            # Insert each unprocessed booking into BoardingDisembarking
            for booking in bookings:
                insert_into_boarding_disembarking(*booking)  # Insert the booking

            return jsonify({"message": f"{len(bookings)} bookings processed and inserted into BoardingDisembarking."}), 200
        else:
            return jsonify({"message": "No new or unprocessed bookings found."}), 200
    except Exception as e:
        print(f"Error fetching and inserting bookings: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()

# Insert a new passenger into BoardingDisembarking with status 'Pending'
def insert_into_boarding_disembarking(booking_id, user_id, qrcode_id, origin, destination, departure_date, departure_time, schedule_id, station_id):
    cursor = mysql.connection.cursor()
    try:
        query = """
            INSERT INTO BoardingDisembarking (Booking_ID, User_ID, Qrcode_ID, Station_ID, Schedule_ID, status)
            VALUES (%s, %s, %s, %s, %s, 'P');
        """
        cursor.execute(query, (booking_id, user_id, qrcode_id, station_id, schedule_id))
        mysql.connection.commit()
        print(f"Booking {booking_id} inserted into BoardingDisembarking with status 'PENDING'.")
    except Exception as e:
        print(f"Error inserting into BoardingDisembarking: {e}")
    finally:
        cursor.close()

# Update booking status to 'Boarded' (B) or 'Cancelled' (C)
def update_booking_status(booking_id, new_status):
    cursor = mysql.connection.cursor()
    try:
        query = """
            UPDATE BoardingDisembarking
            SET status = %s, boarding_time = %s
            WHERE Booking_ID = %s;
        """
        cursor.execute(query, (new_status, datetime.now(), booking_id))
        mysql.connection.commit()
        print(f"Booking {booking_id} status updated to {new_status}.")
    except Exception as e:
        print(f"Error updating booking status: {e}")
    finally:
        cursor.close()

# API endpoint to accept a booking (mark as boarded)
@boarding_passengertable_bp.route('/accept_booking', methods=['POST'])
def accept_booking():
    booking_id = request.json.get('bookingID')
    update_booking_status(booking_id, 'B')  # Update status to 'Boarded (B)'
    return jsonify({"message": "Booking accepted and marked as Boarded."}), 200

# API endpoint to cancel a booking (mark as cancelled)
@boarding_passengertable_bp.route('/cancel_booking', methods=['POST'])
def cancel_booking():
    booking_id = request.json.get('bookingID')
    update_booking_status(booking_id, 'C')  # Update status to 'Cancelled (C)'
    return jsonify({"message": "Booking cancelled."}), 200

# API endpoint to fetch passengers from BoardingDisembarking
@boarding_passengertable_bp.route('/get_passenger_table', methods=['GET'])
def get_passenger_table():
    station_id = request.args.get('station_id')  # Get station ID from query params
    schedule_id = request.args.get('schedule_id')  # Get schedule ID from query params

    cursor = mysql.connection.cursor()

    try:
        query = """
            SELECT
                bd.BD_ID,
                bd.Booking_ID,
                CONCAT(u.first_name, ' ', u.last_name) AS name,
                bd.Station_ID,
                bd.boarding_time,
                bd.disembarking_time,
                bd.status,
                bd.Qrcode_ID
            FROM BoardingDisembarking bd
            LEFT JOIN Booking b ON bd.Booking_ID = b.Booking_ID
            LEFT JOIN Users u ON b.User_ID = u.User_ID
            WHERE b.Schedule_ID = %s AND bd.Station_ID = %s
        """
        cursor.execute(query, (schedule_id, station_id))
        passengers = cursor.fetchall()

        passenger_list = []
        for p in passengers:
            passenger_list.append({
                'BD_ID': p[0],
                'Booking_ID': p[1],
                'name': p[2],
                'Station_ID': p[3],
                'boardingTime': p[4],
                'disembarkingTime': p[5],
                'status': p[6],
                'Qrcode_ID': p[7]
            })

        return jsonify({'passengers': passenger_list})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
