from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import mysql
from datetime import datetime, date

landingboarding_bp = Blueprint('landingboarding_bp', __name__)


# Helper function to get station info for logged-in station admin
def get_station_info(station_id):
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

# Helper function to calculate available seats
def calculate_available_seats(schedule_id, vehicle_capacity, departure_date):
    cursor = mysql.connection.cursor()
    try:
        # Count bookings for this specific schedule and date
        cursor.execute("""
            SELECT COUNT(*) as booked_seats
            FROM Booking b
            WHERE b.departure_date = %s 
            AND b.departure_time = (
                SELECT s.departureTime 
                FROM Schedule s 
                WHERE s.Schedule_ID = %s
            )
            AND b.booking_status IN ('P', 'C')  -- Pending or Confirmed bookings
        """, (departure_date, schedule_id))
        
        result = cursor.fetchone()
        booked_seats = result[0] if result else 0
        available_seats = max(0, vehicle_capacity - booked_seats)
        
        return {
            "available": available_seats,
            "total": vehicle_capacity,
            "booked": booked_seats
        }
    finally:
        cursor.close()

@landingboarding_bp.route('/boarding-schedules', methods=['GET'])
@jwt_required()
def get_boarding_schedules():
    try:
        station_id = get_jwt_identity()
        target_date = request.args.get('date', date.today().isoformat())

        station_info = get_station_info(station_id)
        if not station_info:
            return jsonify({"error": "Station not found"}), 404

        station_id, company_id, station_name = station_info
        cursor = mysql.connection.cursor()

        try:
            # ✅ Pre-aggregate bookings by schedule + date
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
                JOIN Route r ON s.Route_ID = r.Route_ID
                JOIN Vehicle v ON r.Vehicle_ID = v.Vehicle_ID
                LEFT JOIN (
                    SELECT 
                        b.departure_time,
                        COUNT(*) AS booked_seats
                    FROM Booking b
                    WHERE b.departure_date = %s
                    AND b.booking_status IN ('P','C')
                    GROUP BY b.departure_time
                ) b ON b.departure_time = s.departureTime
                WHERE rs.Station_ID = %s
                AND r.Company_ID = %s
                AND s.departureTime IS NOT NULL
                ORDER BY r.Direction, s.departureTime ASC
            """, (target_date, station_id, company_id))

            schedules_data = cursor.fetchall()

            forward_schedules = []
            reverse_schedules = []

            for row in schedules_data:
                (route_id, route_name, direction, route_station_id, stop_order,
                 schedule_id, ride_id, departure_time, eta,
                 vehicle_capacity, booked_seats) = row

                available_seats = max(0, vehicle_capacity - booked_seats)

                schedule_item = {
                    "schedule_id": schedule_id,
                    "ride_id": ride_id,
                    "route_id": route_id,
                    "route_name": route_name,
                    "route_station_id": route_station_id,
                    "departure_time": str(departure_time),
                    "eta": eta,
                    "available_seats": available_seats,
                    "total_seats": vehicle_capacity,
                    "booked_seats": booked_seats
                }

                if direction == 'FO':
                    forward_schedules.append(schedule_item)
                elif direction == 'RE':
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


# Debug endpoint to check what data exists
@landingboarding_bp.route('/debug-routes', methods=['GET'])
@jwt_required()
def debug_routes():
    try:
        station_id = get_jwt_identity()
        
        cursor = mysql.connection.cursor()
        try:
            # Get all routes and their directions for this station
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
                JOIN Route r ON s.Route_ID = r.Route_ID
                WHERE rs.Station_ID = %s
                AND s.departureTime IS NOT NULL
                ORDER BY r.Direction, s.departureTime ASC
            """, (station_id,))
            
            debug_data = cursor.fetchall()
            
            routes_info = []
            directions = {}
            
            for row in debug_data:
                route_id, route_name, direction, route_station_id, schedule_id, departure_time = row
                
                routes_info.append({
                    "route_id": route_id,
                    "route_name": route_name,
                    "direction": direction,
                    "schedule_id": schedule_id,
                    "departure_time": str(departure_time)
                })
                
                if direction not in directions:
                    directions[direction] = 0
                directions[direction] += 1
            
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
    try:
        station_id = get_jwt_identity()
        target_date = request.args.get('date', date.today().isoformat())
        
        # Verify station access to this schedule
        station_info = get_station_info(station_id)
        if not station_info:
            return jsonify({"error": "Station not found"}), 404
        
        cursor = mysql.connection.cursor()
        try:
            # Get detailed schedule information
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
                JOIN Route r ON s.Route_ID = r.Route_ID
                JOIN Vehicle v ON r.Vehicle_ID = v.Vehicle_ID
                WHERE s.Schedule_ID = %s
                AND rs.Station_ID = %s
            """, (schedule_id, station_id))
            
            schedule_row = cursor.fetchone()
            if not schedule_row:
                return jsonify({"error": "Schedule not found or access denied"}), 404
            
            schedule_id, ride_id, departure_time, eta, route_id, route_name, direction, station_name, stop_order, capacity, vehicle_type = schedule_row
            
            # Get seat availability
            seat_info = calculate_available_seats(schedule_id, capacity, target_date)
            
            # Get existing bookings for this schedule and date
            cursor.execute("""
                SELECT 
                    b.Booking_ID,
                    b.User_ID,
                    b.origin,
                    b.destination,
                    b.payment_status,
                    b.booking_status,
                    b.booking_source,
                    bd.BD_ID,
                    bd.boarding_time,
                    bd.disembarking_time,
                    bd.status as bd_status
                FROM Booking b
                LEFT JOIN BoardingDisembarking bd ON b.Booking_ID = bd.Booking_ID AND bd.Station_ID = %s
                WHERE b.departure_date = %s
                AND b.departure_time = %s
                AND b.booking_status IN ('P', 'C')
                ORDER BY b.Booking_ID
            """, (station_id, target_date, departure_time))
            
            bookings_data = cursor.fetchall()
            bookings = []
            
            for booking_row in bookings_data:
                booking_id, user_id, origin, destination, payment_status, booking_status, booking_source, bd_id, boarding_time, disembarking_time, bd_status = booking_row
                
                bookings.append({
                    "booking_id": booking_id,
                    "user_id": user_id,
                    "origin": origin,
                    "destination": destination,
                    "payment_status": payment_status,
                    "booking_status": booking_status,
                    "booking_source": booking_source,
                    "boarding_data": {
                        "bd_id": bd_id,
                        "boarding_time": str(boarding_time) if boarding_time else None,
                        "disembarking_time": str(disembarking_time) if disembarking_time else None,
                        "status": bd_status
                    }
                })
            
            return jsonify({
                "schedule_info": {
                    "schedule_id": schedule_id,
                    "ride_id": ride_id,
                    "route_name": route_name,
                    "direction": "Forward" if direction == 'FW' else "Reverse",
                    "station_name": station_name,
                    "departure_time": str(departure_time),
                    "eta": eta,
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

# Helper endpoint to get station routes for dropdown/selection
@landingboarding_bp.route('/station-routes', methods=['GET'])
@jwt_required()
def get_station_routes():
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
            
            routes_data = cursor.fetchall()
            routes = []
            
            for row in routes_data:
                route_id, route_name, direction = row
                routes.append({
                    "route_id": route_id,
                    "route_name": route_name,
                    "direction": "Forward" if direction == 'FW' else "Reverse",
                    "direction_code": direction
                })
            
            return jsonify(routes), 200
            
        finally:
            cursor.close()
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500