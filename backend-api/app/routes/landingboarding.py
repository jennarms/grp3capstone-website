from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import mysql
from datetime import date

landingboarding_bp = Blueprint('landingboarding_bp', __name__)

# -------------------------------------------------------------------
# helpers
# -------------------------------------------------------------------

def get_station_info(station_id):
    """Return (Station_ID, Company_ID, StationName) or None."""
    cursor = mysql.connection.cursor()
    try:
        cursor.execute("""
            SELECT Station_ID, Company_ID, StationName
            FROM Station
            WHERE Station_ID = %s
        """, (station_id,))
        return cursor.fetchone()
    finally:
        cursor.close()

def normalize_direction(dir_code: str) -> str:
    """
    Map DB codes to 'forward' | 'reverse' for the API.
    Accepts FW/FO/FWD/FORWARD → forward; RV/RE/REV/REVERSE → reverse.
    """
    if not dir_code:
        return "forward"
    code = str(dir_code).upper()
    if code in ("FW", "FO", "FWD", "FORWARD"):
        return "forward"
    if code in ("RV", "RE", "REV", "REVERSE"):
        return "reverse"
    return "forward"

def calculate_available_seats(schedule_id, vehicle_capacity, departure_date):
    cursor = mysql.connection.cursor()
    try:
        cursor.execute("""
            SELECT COUNT(*) AS booked_seats
            FROM Booking b
            LEFT JOIN BoardingDisembarking bd ON b.Booking_ID = bd.Booking_ID
            WHERE b.departure_date = %s
              AND b.Schedule_ID = %s
              AND bd.status IN ('P', 'B')  -- Pending or Boarded status
        """, (departure_date, schedule_id))
        result = cursor.fetchone()
        booked_seats = int(result[0]) if result else 0
        vehicle_capacity = int(vehicle_capacity or 0)
        available_seats = max(0, vehicle_capacity - booked_seats)
        return {
            "available": available_seats,
            "total": vehicle_capacity,
            "booked": booked_seats
        }
    finally:
        cursor.close()

# -------------------------------------------------------------------
# routes
# -------------------------------------------------------------------

@landingboarding_bp.route('/boarding-schedules', methods=['GET'])
@jwt_required()
def get_boarding_schedules():
    """
    Landing page source: list forward/reverse schedules for the logged-in station,
    for the provided service date. Seat counts are time-based (see NOTE above).
    """
    try:
        station_id = get_jwt_identity()
        target_date = request.args.get('date', date.today().isoformat())

        station_info = get_station_info(station_id)
        if not station_info:
            return jsonify({"error": "Station not found"}), 404

        station_id, company_id, station_name = station_info
        cursor = mysql.connection.cursor()

        try:
            # Time-based pre-aggregation of bookings for that date.
            # TODO (when Booking.Schedule_ID exists): group by schedule_id instead of departure_time.
            cursor.execute("""
                SELECT 
                    r.Route_ID,
                    r.Route_name,
                    r.Direction,
                    rs.RouteStation_ID,
                    rs.StopOrder,
                    s.Schedule_ID,
                    s.Ride_ID,
                    s.departureTime,
                    s.ETA,
                    v.Capacity AS vehicle_capacity,
                    IFNULL(b.booked_seats, 0) AS booked_seats
                FROM Schedule s
                JOIN RouteStations rs ON s.RouteStation_ID = rs.RouteStation_ID
                JOIN Route r          ON s.Route_ID        = r.Route_ID
                JOIN Vehicle v        ON r.Vehicle_ID      = v.Vehicle_ID
                LEFT JOIN (
                    SELECT 
                        b.departure_time,
                        COUNT(*) AS booked_seats
                    FROM Booking b
                    LEFT JOIN BoardingDisembarking bd ON b.Booking_ID = bd.Booking_ID
                    WHERE b.departure_date = %s
                      AND bd.status IN ('P','B')  -- Pending or Boarded
                    GROUP BY b.departure_time
                ) b ON b.departure_time = s.departureTime
                WHERE rs.Station_ID   = %s
                  AND r.Company_ID    = %s
                  AND s.departureTime IS NOT NULL
                ORDER BY r.Direction, s.departureTime ASC
            """, (target_date, station_id, company_id))

            schedules_data = cursor.fetchall()

            forward_schedules = []
            reverse_schedules = []

            for row in schedules_data:
                (route_id, route_name, direction_code, route_station_id, stop_order,
                 schedule_id, ride_id, departure_time, eta,
                 vehicle_capacity, booked_seats) = row

                direction = normalize_direction(direction_code)
                vehicle_capacity = int(vehicle_capacity or 0)
                booked_seats = int(booked_seats or 0)
                available_seats = max(0, vehicle_capacity - booked_seats)

                schedule_item = {
                    "schedule_id": str(schedule_id),
                    "ride_id": str(ride_id),
                    "route_id": str(route_id),
                    "route_name": route_name,
                    "direction": direction,                      # 'forward' | 'reverse'
                    "departure_time": str(departure_time),       # "HH:MM:SS" (UI formats to 12h)
                    "eta_minutes": eta,
                    "available_seats": available_seats,
                    "total_seats": vehicle_capacity,
                    "booked_seats": booked_seats
                }

                if direction == 'forward':
                    forward_schedules.append(schedule_item)
                else:
                    reverse_schedules.append(schedule_item)

            return jsonify({
                "station_name": station_name,
                "date": target_date,
                "forward_schedules": forward_schedules,
                "reverse_schedules": reverse_schedules
            }), 200

        finally:
            cursor.close()

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@landingboarding_bp.route('/debug-routes', methods=['GET'])
@jwt_required()
def debug_routes():
    """Debug helper to see routes/directions visible to this station."""
    try:
        station_id = get_jwt_identity()
        cursor = mysql.connection.cursor()
        try:
            cursor.execute("""
                SELECT 
                    r.Route_ID,
                    r.Route_name,
                    r.Direction,
                    rs.RouteStation_ID,
                    s.Schedule_ID,
                    s.departureTime
                FROM Schedule s
                JOIN RouteStations rs ON s.RouteStation_ID = rs.RouteStation_ID
                JOIN Route r          ON s.Route_ID        = r.Route_ID
                WHERE rs.Station_ID   = %s
                  AND s.departureTime IS NOT NULL
                ORDER BY r.Direction, s.departureTime ASC
            """, (station_id,))
            debug_data = cursor.fetchall()

            routes_info = []
            directions = {}

            for row in debug_data:
                route_id, route_name, dir_code, route_station_id, schedule_id, departure_time = row
                dir_api = normalize_direction(dir_code)
                routes_info.append({
                    "route_id": str(route_id),
                    "route_name": route_name,
                    "direction": dir_api,
                    "schedule_id": str(schedule_id),
                    "departure_time": str(departure_time)
                })
                directions[dir_api] = directions.get(dir_api, 0) + 1

            return jsonify({
                "station_id": station_id,
                "total_schedules": len(routes_info),
                "direction_counts": directions,
                "all_routes": routes_info
            }), 200

        finally:
            cursor.close()

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@landingboarding_bp.route('/schedule-details/<schedule_id>', methods=['GET'])
@jwt_required()
def get_schedule_details(schedule_id):
    """
    Detail page source for a single schedule instance.
    NOTE: seat availability and booking list are still time-based because
          Booking does not store Schedule_ID. See TODOs to migrate later.
    """
    try:
        station_id = get_jwt_identity()
        target_date = request.args.get('date', date.today().isoformat())

        station_info = get_station_info(station_id)
        if not station_info:
            return jsonify({"error": "Station not found"}), 404

        cursor = mysql.connection.cursor()
        try:
            # Schedule header
            cursor.execute("""
                SELECT 
                    s.Schedule_ID,
                    s.Ride_ID,
                    s.departureTime,
                    s.ETA,
                    r.Route_ID,
                    r.Route_name,
                    r.Direction,
                    rs.StationName,
                    rs.StopOrder,
                    v.Capacity,
                    v.vehicleType
                FROM Schedule s
                JOIN RouteStations rs ON s.RouteStation_ID = rs.RouteStation_ID
                JOIN Route r          ON s.Route_ID        = r.Route_ID
                JOIN Vehicle v        ON r.Vehicle_ID      = v.Vehicle_ID
                WHERE s.Schedule_ID = %s
                  AND rs.Station_ID = %s
            """, (schedule_id, station_id))

            row = cursor.fetchone()
            if not row:
                return jsonify({"error": "Schedule not found or access denied"}), 404

            (sch_id, ride_id, departure_time, eta, route_id, route_name,
             dir_code, station_name, stop_order, capacity, vehicle_type) = row

            # Seat info (time-based)
            seat_info = calculate_available_seats(sch_id, capacity, target_date)

            # Bookings list (time-based)
            cursor.execute("""
                SELECT 
                    b.Booking_ID,
                    b.User_ID,
                    b.Qrcode_ID,
                    b.origin,
                    b.destination,
                    b.payment_status,
                    b.payment_amount,
                    b.paid_at,
                    bd.status AS bd_status,
                    bd.boarding_time,
                    bd.disembarking_time
                FROM Booking b
                LEFT JOIN BoardingDisembarking bd
                       ON b.Booking_ID = bd.Booking_ID
                      AND bd.Station_ID = %s
                WHERE b.departure_date = %s
                  AND b.departure_time = %s
                  AND bd.status IN ('P','B')  -- Pending or Boarded
                ORDER BY b.Booking_ID
            """, (station_id, target_date, departure_time))

            bookings = []
            for (booking_id, user_id, qr_code_id, origin, destination,
                 payment_status, payment_amount, paid_at, bd_status,
                 boarding_time, disembarking_time) in cursor.fetchall():
                bookings.append({
                    "booking_id": booking_id,
                    "user_id": user_id,
                    "qr_code_id": qr_code_id,
                    "origin": origin,
                    "destination": destination,
                    "payment_status": payment_status,
                    "payment_amount": float(payment_amount) if payment_amount is not None else None,
                    "paid_at": str(paid_at) if paid_at else None,
                    "boarding_data": {
                        "bd_status": bd_status,
                        "boarding_time": str(boarding_time) if boarding_time else None,
                        "disembarking_time": str(disembarking_time) if disembarking_time else None
                    }
                })

            return jsonify({
                "schedule_info": {
                    "schedule_id": str(sch_id),
                    "ride_id": str(ride_id),
                    "route_id": str(route_id),
                    "route_name": route_name,
                    "direction": normalize_direction(dir_code),
                    "station_name": station_name,
                    "departure_time": str(departure_time),  # "HH:MM:SS"
                    "eta_minutes": eta,
                    "stop_order": stop_order,
                    "vehicle_type": vehicle_type,
                    "date": target_date
                },
                "seat_info": seat_info,
                "bookings": bookings
            }), 200

        finally:
            cursor.close()

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@landingboarding_bp.route('/station-routes', methods=['GET'])
@jwt_required()
def get_station_routes():
    """Simple dropdown data for routes visible to this station."""
    try:
        station_id = get_jwt_identity()

        station_info = get_station_info(station_id)
        if not station_info:
            return jsonify({"error": "Station not found"}), 404

        cursor = mysql.connection.cursor()
        try:
            cursor.execute("""
                SELECT DISTINCT
                    r.Route_ID,
                    r.Route_name,
                    r.Direction
                FROM Route r
                JOIN RouteStations rs ON r.Route_ID = rs.Route_ID
                WHERE rs.Station_ID = %s
                ORDER BY r.Route_name, r.Direction
            """, (station_id,))

            routes = []
            for (route_id, route_name, dir_code) in cursor.fetchall():
                routes.append({
                    "route_id": str(route_id),
                    "route_name": route_name,
                    "direction": normalize_direction(dir_code),
                    "direction_code": dir_code
                })

            return jsonify(routes), 200

        finally:
            cursor.close()

    except Exception as e:
        return jsonify({"error": str(e)}), 500
