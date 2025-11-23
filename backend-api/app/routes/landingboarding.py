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


def calculate_available_seats(vehicle_capacity, departure_date, departure_time):
    """
    Calculate seat availability for a given date + time.

    We treat BoardingDisembarking as the source of truth for who is
    actually using a seat on that run.

      booked_seats = count of BoardingDisembarking rows with:
                       - matching departure_date
                       - matching departure_time
                       - status in ('P','B')    (Pending / Boarded)
      available    = max(0, capacity - booked_seats)

    NOTE:
      - We ignore Schedule_ID here because your sample data shows it can be
        NULL or 'NoSchedule' for some rows.
      - 'C' (Cancelled) and 'D' (Disembarked) do NOT reduce available seats
        at departure for this view.
    """
    cursor = mysql.connection.cursor()
    try:
        cursor.execute("""
            SELECT COUNT(*) AS booked_seats
            FROM BoardingDisembarking bd
            WHERE bd.departure_date = %s
              AND bd.departure_time = %s
              AND bd.status IN ('P','B')   -- Pending / Boarded consume seats
        """, (departure_date, departure_time))

        result = cursor.fetchone()
        booked_seats = int(result[0]) if result and result[0] is not None else 0
        vehicle_capacity = int(vehicle_capacity or 0)
        available_seats = max(0, vehicle_capacity - booked_seats)

        return {
            "available": available_seats,
            "total": vehicle_capacity,
            "booked": booked_seats,
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
    for the provided service date.

    Seat availability is TIME-BASED per schedule row:

      booked_seats  = BoardingDisembarking rows on that departure_date + departure_time
                      with status in ('P','B')
      available     = max(0, capacity - booked_seats)
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
            # Get schedules only; seat counts will be computed per row in Python
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
                    v.Capacity AS vehicle_capacity
                FROM Schedule s
                JOIN RouteStations rs ON s.RouteStation_ID = rs.RouteStation_ID
                JOIN Route r          ON s.Route_ID        = r.Route_ID
                JOIN Vehicle v        ON r.Vehicle_ID      = v.Vehicle_ID
                WHERE rs.Station_ID   = %s
                  AND r.Company_ID    = %s
                  AND s.departureTime IS NOT NULL
                ORDER BY r.Direction, s.departureTime ASC
            """, (station_id, company_id))

            schedules_data = cursor.fetchall()

            forward_schedules = []
            reverse_schedules = []

            for row in schedules_data:
                (
                    route_id,
                    route_name,
                    direction_code,
                    route_station_id,
                    stop_order,
                    schedule_id,
                    ride_id,
                    departure_time,
                    eta,
                    vehicle_capacity,
                ) = row

                direction = normalize_direction(direction_code)
                # Compute seat info using BoardingDisembarking (time-based)
                seat_info = calculate_available_seats(
                    vehicle_capacity,
                    target_date,
                    departure_time,
                )

                available_seats = seat_info["available"]
                booked_seats = seat_info["booked"]
                vehicle_capacity = seat_info["total"]

                schedule_item = {
                    "schedule_id": str(schedule_id),
                    "ride_id": str(ride_id),
                    "route_id": str(route_id),
                    "route_name": route_name,
                    "direction": direction,                      # 'forward' | 'reverse'
                    "departure_time": str(departure_time),       # "HH:MM:SS"
                    "eta_minutes": eta,
                    "available_seats": available_seats,
                    "total_seats": vehicle_capacity,
                    "booked_seats": booked_seats,
                }

                if direction == "forward":
                    forward_schedules.append(schedule_item)
                else:
                    reverse_schedules.append(schedule_item)

            return jsonify({
                "station_name": station_name,
                "date": target_date,
                "forward_schedules": forward_schedules,
                "reverse_schedules": reverse_schedules,
                "total_forward": len(forward_schedules),
                "total_reverse": len(reverse_schedules),
                "total_schedules": len(forward_schedules) + len(reverse_schedules),
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

    Seat availability is time-based via calculate_available_seats()
    to stay consistent with how BoardingDisembarking rows are stored.
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

            (
                sch_id,
                ride_id,
                departure_time,
                eta,
                route_id,
                route_name,
                dir_code,
                station_name,
                stop_order,
                capacity,
                vehicle_type,
            ) = row

            # Seat info (time-based: date + departure_time)
            seat_info = calculate_available_seats(
                capacity,
                target_date,
                departure_time,
            )

            # Bookings list (time-based: by date + time at this station)
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
            for (
                booking_id,
                user_id,
                qr_code_id,
                origin,
                destination,
                payment_status,
                payment_amount,
                paid_at,
                bd_status,
                boarding_time,
                disembarking_time,
            ) in cursor.fetchall():
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
                        "disembarking_time": str(disembarking_time) if disembarking_time else None,
                    },
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
                    "date": target_date,
                },
                "seat_info": seat_info,
                "bookings": bookings,
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
                    "direction_code": dir_code,
                })

            return jsonify(routes), 200

        finally:
            cursor.close()

    except Exception as e:
        return jsonify({"error": str(e)}), 500
