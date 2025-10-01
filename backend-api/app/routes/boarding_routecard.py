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


def _time_based_seat_info(schedule_id, service_date, vehicle_capacity):
    """
    Compute seats by (departure_date + schedule_id) now that Booking stores Schedule_ID.
    Updated to use BoardingDisembarking's status for booked seats.
    """
    cur = mysql.connection.cursor()
    try:
        cur.execute("""
            SELECT COUNT(*) AS booked_seats
            FROM Booking b
            LEFT JOIN BoardingDisembarking bd ON b.Booking_ID = bd.Booking_ID
            WHERE b.departure_date = %s
              AND b.Schedule_ID = %s
              AND bd.status IN ('P', 'B')  -- Pending or Boarded
        """, (service_date, schedule_id))
        row = cur.fetchone()
        booked = int(row[0]) if row else 0
        total = int(vehicle_capacity or 0)
        available = max(0, total - booked)
        return {"total": total, "booked": booked, "available": available}
    finally:
        cur.close()

# -------------------------------------------------------------------
# route
# -------------------------------------------------------------------

@boarding_routecard_bp.route('/boarding/routecard/<schedule_id>', methods=['GET'])
@jwt_required()
def get_routecard(schedule_id):
    """
    Route card payload for a given schedule instance and date (for the logged-in station).
    GET /api/boarding/routecard/<schedule_id>?date=YYYY-MM-DD

    Returns:
    {
      "station_name": "...",       # current station (from JWT)
      "date": "YYYY-MM-DD",
      "schedule_info": {
        "schedule_id": "...",
        "ride_id": "...",
        "route_id": "...",
        "route_name": "...",
        "direction": "forward"|"reverse",
        "station_name": "...",     # current station
        "departure_time": "HH:MM:SS",
        "eta_minutes": 12,         # nullable
        "stop_order": 3,
        "vehicle_type": "...",
        "total_seats": 40,
        "booked_seats": 12,
        "available_seats": 28
      },
      "stops": [
        { "station_id": "...", "station_name": "Quinta", "stop_order": 1, "stop_time": "07:00:00" },
        { "station_id": "...", "station_name": "PUP",    "stop_order": 2, "stop_time": "07:10:00" },
        ...
      ]
    }
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
            seat = _time_based_seat_info(sch_id, service_date, capacity)

            # 3) Fetch full route stops (ordered) WITH per-stop time for THIS ride
            #    (this is the part you needed to change)
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
                 AND s2.Ride_ID         = %s         -- same "trip instance" across all stops
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
                    # optional helper if you want it on the UI:
                    # "is_current": int(sorder or 0) == int(stop_order or 0)
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
                    "station_name": current_station_name,     # current station row for this scheduleId
                    "departure_time": str(departure_time),    # "HH:MM:SS"
                    "eta_minutes": eta,
                    "stop_order": int(stop_order or 0),
                    "vehicle_type": vehicle_type,
                    "total_seats": seat["total"],
                    "booked_seats": seat["booked"],
                    "available_seats": seat["available"]
                },
                "stops": stops
            }
            return jsonify(payload), 200

        finally:
            cur.close()

    except Exception as e:
        return jsonify({"error": str(e)}), 500
