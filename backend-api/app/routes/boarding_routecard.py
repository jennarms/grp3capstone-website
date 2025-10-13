from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import mysql
from datetime import date

boarding_routecard_bp = Blueprint('boarding_routecard_bp', __name__)

# -------------------------------------------------------------------
# helpers
# -------------------------------------------------------------------

def _get_station_info(station_id):
    """Return (Station_ID, Company_ID, StationName) or None."""
    cur = mysql.connection.cursor()
    try:
        cur.execute("""
            SELECT Station_ID, Company_ID, StationName
            FROM Station
            WHERE Station_ID = %s
        """, (station_id,))
        return cur.fetchone()
    finally:
        cur.close()

def _normalize_direction(dir_code: str) -> str:
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

def _get_vehicle_capacity(route_id):
    """Fetch vehicle capacity from the Vehicle table based on the route."""
    cur = mysql.connection.cursor()
    try:
        cur.execute("""
            SELECT v.Capacity
            FROM Route r
            JOIN Vehicle v ON r.Vehicle_ID = v.Vehicle_ID
            WHERE r.Route_ID = %s
        """, (route_id,))
        row = cur.fetchone()
        return row[0] if row else None  # Fetch the capacity from the Vehicle table
    finally:
        cur.close()

def _count_seats_taken(service_date, origin, departure_time, schedule_id):
    """
    Count seats taken for a given date, origin, departure time, and schedule ID
    considering passengers with status 'P' (Pending) or 'B' (Boarded)
    """
    cur = mysql.connection.cursor()
    try:
        # Query to count seats with status 'P' (Pending) or 'B' (Boarded) in BoardingDisembarking
        cur.execute("""
            SELECT COUNT(*) AS seats_taken
            FROM BoardingDisembarking bd
            WHERE bd.departure_date = %s
              AND bd.origin = %s
              AND bd.departure_time = %s
              AND bd.Schedule_ID = %s
              AND bd.status IN ('P', 'B')  -- Only Pending (P) or Boarded (B) passengers
        """, (service_date, origin, departure_time, schedule_id))
        
        row = cur.fetchone()
        return int(row[0]) if row else 0
    finally:
        cur.close()

# -------------------------------------------------------------------
# route
# -------------------------------------------------------------------

@boarding_routecard_bp.route('/boarding/available_seats', methods=['GET'])
@jwt_required()
def get_available_seats():
    """
    Endpoint to calculate the available seats for a given schedule, departure date, origin and time.
    GET /api/boarding/available_seats?schedule_id=<schedule_id>&date=<YYYY-MM-DD>&origin=<origin>&departure_time=<HH:MM>
    """
    try:
        # Get data from the request
        station_id = get_jwt_identity()
        service_date = request.args.get('date', date.today().isoformat())
        origin = request.args.get('origin')
        departure_time = request.args.get('departure_time')
        schedule_id = request.args.get('schedule_id')

        # 1) Fetch the relevant schedule details to get the departure time and origin
        cur = mysql.connection.cursor()
        cur.execute("""
            SELECT s.departureTime, rs.StationName
            FROM Schedule s
            JOIN RouteStations rs ON s.RouteStation_ID = rs.RouteStation_ID
            WHERE s.Schedule_ID = %s
        """, (schedule_id,))
        schedule_row = cur.fetchone()
        if not schedule_row:
            return jsonify({"error": f"Schedule {schedule_id} not found."}), 404

        departure_time_from_schedule, origin_from_schedule = schedule_row

        # Check if the origin from the request matches the one in the schedule
        if origin != origin_from_schedule:
            return jsonify({"error": f"Origin {origin} does not match the scheduled origin {origin_from_schedule}."}), 400

        # 2) Fetch vehicle capacity for the given schedule's route
        cur.execute("""
            SELECT r.Route_ID
            FROM Schedule s
            JOIN Route r ON s.Route_ID = r.Route_ID
            WHERE s.Schedule_ID = %s
        """, (schedule_id,))
        route_row = cur.fetchone()
        if not route_row:
            return jsonify({"error": "Route not found for the given schedule."}), 404
        
        route_id = route_row[0]

        # Fetch vehicle capacity for the given route_id
        vehicle_capacity = _get_vehicle_capacity(route_id)
        if vehicle_capacity is None:
            return jsonify({"error": "Vehicle capacity not found for the given route."}), 404

        # 3) Count seats taken for the given parameters (departure date, origin, departure time, and schedule ID)
        seats_taken = _count_seats_taken(service_date, origin, departure_time, schedule_id)

        # 4) Calculate available seats
        available_seats = max(0, vehicle_capacity - seats_taken)

        # Return the response
        return jsonify({
            "vehicle_capacity": vehicle_capacity,
            "seats_taken": seats_taken,
            "available_seats": available_seats
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@boarding_routecard_bp.route('/boarding/routecard/<schedule_id>', methods=['GET'])
@jwt_required()
def get_routecard(schedule_id):
    """
    Route card payload for a given schedule instance and date (for the logged-in station).
    GET /api/boarding/routecard/<schedule_id>?date=YYYY-MM-DD
    """
    try:
        station_id = get_jwt_identity()
        service_date = request.args.get('date', date.today().isoformat())

        st_info = _get_station_info(station_id)
        if not st_info:
            return jsonify({"error": "Station not found"}), 404

        station_id, company_id, station_name = st_info

        cur = mysql.connection.cursor()
        try:
            # 1) Fetch schedule header for THIS station (access control)
            cur.execute("""
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
                  AND r.Company_ID  = %s
            """, (schedule_id, station_id, company_id))

            head = cur.fetchone()
            if not head:
                return jsonify({"error": "Schedule not found or access denied"}), 404

            (sch_id, ride_id, departure_time, eta,
             route_id, route_name, dir_code, current_station_name,
             stop_order, capacity, vehicle_type) = head

            # 2) Compute seat info (time-based)
            seat = _count_seats_taken(service_date, current_station_name, departure_time, schedule_id)

            # 3) Fetch full route stops (ordered) WITH per-stop time for THIS ride
            cur.execute("""
                SELECT
                    rs.Station_ID,
                    rs.StationName,
                    rs.StopOrder,
                    s2.departureTime AS stop_time
                FROM RouteStations rs
                LEFT JOIN Schedule s2
                  ON s2.RouteStation_ID = rs.RouteStation_ID
                 AND s2.Route_ID        = rs.Route_ID
                 AND s2.Ride_ID         = %s
                WHERE rs.Route_ID = %s
                ORDER BY rs.StopOrder ASC
            """, (ride_id, route_id))

            stops = []
            for (sid, sname, sorder, stime) in cur.fetchall():
                stops.append({
                    "station_id": str(sid),
                    "station_name": sname,
                    "stop_order": int(sorder or 0),
                    "stop_time": str(stime) if stime is not None else None,
                })

            payload = {
                "station_name": station_name,   # station from JWT
                "date": service_date,
                "schedule_info": {
                    "schedule_id": str(sch_id),
                    "ride_id": str(ride_id),
                    "route_id": str(route_id),
                    "route_name": route_name,
                    "direction": _normalize_direction(dir_code),
                    "station_name": current_station_name,
                    "departure_time": str(departure_time),
                    "eta_minutes": eta,
                    "stop_order": int(stop_order or 0),
                    "vehicle_type": vehicle_type,
                    "total_seats": capacity,
                    "seats_taken": seat,  # Correct value for seats taken
                    "available_seats": max(0, capacity - seat)  # Calculate available seats
                },
                "stops": stops
            }
            return jsonify(payload), 200

        finally:
            cur.close()

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@boarding_routecard_bp.route('/boarding/routecard/station', methods=['GET'])
@jwt_required()
def get_station_name():
    """
    Fetch only the station name for the logged-in user.
    """
    try:
        # Get the station_id from the JWT identity
        station_id = get_jwt_identity()

        # Fetch the station information using the helper function
        st_info = _get_station_info(station_id)
        if not st_info:
            return jsonify({"error": "Station not found"}), 404

        # Extract the station_name from the fetched data
        station_id, company_id, station_name = st_info

        # Return the station name
        return jsonify({
            "station_name": station_name
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
