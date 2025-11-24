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
    if not dir_code:
        return "forward"
    code = str(dir_code).upper()
    if code in ("FW", "FO", "FWD", "FORWARD"):
        return "forward"
    if code in ("RV", "RE", "REV", "REVERSE"):
        return "reverse"
    return "forward"


def _count_seats_taken(service_date, station_id, departure_time):
    """
    Count seats taken for a given date, station, and departure time.
    """
    cur = mysql.connection.cursor()
    try:
        cur.execute("""
            SELECT COUNT(*) AS booked_seats
            FROM Booking b
            LEFT JOIN BoardingDisembarking bd ON b.Booking_ID = bd.Booking_ID
            WHERE b.departure_date = %s
              AND b.origin = %s
              AND b.departure_time = %s
              AND bd.status IN ('P', 'B')
        """, (service_date, station_id, departure_time))
        row = cur.fetchone()
        return int(row[0]) if row and row[0] is not None else 0
    finally:
        cur.close()

# -------------------------------------------------------------------
# endpoints
# -------------------------------------------------------------------

@boarding_routecard_bp.route('/count-seats-taken', methods=['GET'])
@boarding_routecard_bp.route('/boarding/count-seats-taken', methods=['GET'])
@jwt_required()
def count_seats_taken():
    try:
        service_date = request.args.get('date')
        station_id = (
            request.args.get('origin')
            or request.args.get('station_id')
            or get_jwt_identity()
        )
        departure_time = request.args.get('departure_time')

        if not service_date or not station_id or not departure_time:
            return jsonify({"error": "Missing date, station_id/origin, or departure_time"}), 400

        seats_taken = _count_seats_taken(service_date, station_id, departure_time)
        print(f"Calculated seats_taken: {seats_taken} for {service_date} {station_id} {departure_time}")

        return jsonify({"seats_taken": seats_taken}), 200

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
            # 🔹 IMPORTANT CHANGE: Vehicle joined via Schedule.Vehicle_ID
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
                LEFT JOIN Vehicle v   ON s.Vehicle_ID      = v.Vehicle_ID
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

            seats_taken = _count_seats_taken(service_date, station_id, departure_time)

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
                "station_name": station_name,
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
                    "total_seats": int(capacity or 0),
                    "seats_taken": seats_taken,
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
        station_id = get_jwt_identity()
        st_info = _get_station_info(station_id)
        if not st_info:
            return jsonify({"error": "Station not found"}), 404

        station_id, company_id, station_name = st_info

        return jsonify({
            "station_name": station_name
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
