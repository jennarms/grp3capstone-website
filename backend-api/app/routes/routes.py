from flask import Blueprint, request, jsonify
from app import mysql
from flask_jwt_extended import jwt_required, get_jwt_identity

# Blueprint
routes_bp = Blueprint("routes", __name__, url_prefix="/api/routes")

# Helper functions
def generate_route_id(company_id):
    cur = mysql.connection.cursor()
    cur.execute("SELECT Route_ID FROM Route WHERE Company_ID=%s AND Route_ID REGEXP '^R[0-9]+$' ORDER BY Route_ID DESC LIMIT 1", (company_id,))
    last_id = cur.fetchone()
    cur.close()
    
    if last_id:
        last_num = int(last_id[0][1:])
        new_num = last_num + 1
    else:
        new_num = 1
    return f"R{new_num:03d}"

def generate_route_station_id():
    cur = mysql.connection.cursor()
    cur.execute("SELECT RouteStation_ID FROM RouteStations WHERE RouteStation_ID REGEXP '^RS[0-9]+$' ORDER BY RouteStation_ID DESC LIMIT 1")
    last_id = cur.fetchone()
    cur.close()
    
    if last_id:
        last_num = int(last_id[0][2:])
        new_num = last_num + 1
    else:
        new_num = 1
    return f"RS{new_num:03d}"

def get_company_id_for_admin(admin_id):
    cur = mysql.connection.cursor()
    cur.execute("SELECT Company_ID FROM MainAdmin WHERE Admin_ID=%s", (admin_id,))
    row = cur.fetchone()
    cur.close()
    return row[0] if row else None

# ===========================
# ROUTES CRUD
# ===========================

# Get all routes for the logged-in admin's company
@routes_bp.route("/", methods=["GET"])
@jwt_required()
def get_routes():
    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        
        if not company_id:
            return jsonify([]), 200

        cur = mysql.connection.cursor()
        cur.execute("""
            SELECT Route_ID, Company_ID, Route_name, Water_flow, direction, Vehicle_ID
            FROM Route
            WHERE Company_ID=%s
            ORDER BY Route_ID
        """, (company_id,))
        routes_rows = cur.fetchall()
        cur.close()

        routes = []
        for r in routes_rows:
            routes.append({
                "route_id": r[0],
                "company_id": r[1],
                "route_name": r[2],
                "water_flow": r[3] if r[3] else None,
                "direction": r[4],
                "vehicle_id": r[5]
            })

        return jsonify(routes), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Create a new route (automatic Vehicle_ID + max routes)
@routes_bp.route("/", methods=["POST"])
@jwt_required()
def create_route():
    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        
        if not company_id:
            return jsonify({"error": "Company not found for admin"}), 400

        cur = mysql.connection.cursor()

        # Get the first available vehicle (no Company_ID filter)
        cur.execute("SELECT Vehicle_ID, vehicleType FROM Vehicle LIMIT 1")
        vehicle_row = cur.fetchone()
        if not vehicle_row:
            cur.close()
            return jsonify({"error": "No vehicle found"}), 400

        vehicle_id, vehicle_type = vehicle_row

        # Determine max routes based on vehicle type
        if vehicle_type in ["Ferry", "Roll-on/Roll-off Vessels"]:
            max_routes = 4
        else:  # land vehicles
            max_routes = 2

        # Check current route count
        cur.execute("SELECT COUNT(*) FROM Route WHERE Company_ID=%s", (company_id,))
        count = cur.fetchone()[0]
        if count >= max_routes:
            cur.close()
            return jsonify({"error": f"Maximum of {max_routes} routes reached for this vehicle type"}), 400

        data = request.get_json()
        route_name = data.get("route_name")
        water_flow = data.get("water_flow")  # US / DS / null
        direction = data.get("direction")    # FW / RV

        # Validation
        if not route_name or not direction:
            cur.close()
            return jsonify({"error": "Missing required fields: route_name and direction"}), 400

        if direction not in ['FW', 'RV']:
            cur.close()
            return jsonify({"error": "Invalid direction. Must be FW (Forward) or RV (Reverse)"}), 400

        if water_flow and water_flow not in ['US', 'DS']:
            cur.close()
            return jsonify({"error": "Invalid water_flow. Must be US (Upstream), DS (Downstream), or null"}), 400

        route_id = generate_route_id(company_id)
        
        # Insert the new route with automatic Vehicle_ID
        cur.execute("""
            INSERT INTO Route (Route_ID, Company_ID, Route_name, Water_flow, direction, Vehicle_ID)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (route_id, company_id, route_name, water_flow, direction, vehicle_id))
        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Route created successfully", "route_id": route_id, "vehicle_id": vehicle_id}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Delete a route
@routes_bp.route("/<route_id>", methods=["DELETE"])
@jwt_required()
def delete_route(route_id):
    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        
        if not company_id:
            return jsonify({"error": "Company not found for admin"}), 400

        cur = mysql.connection.cursor()
        
        # Check if route belongs to admin's company
        cur.execute("SELECT Route_ID FROM Route WHERE Route_ID=%s AND Company_ID=%s", (route_id, company_id))
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "Route not found or access denied"}), 404

        # Delete route stations first (foreign key constraint)
        cur.execute("DELETE FROM RouteStations WHERE Route_ID=%s", (route_id,))
        
        # Delete the route
        cur.execute("DELETE FROM Route WHERE Route_ID=%s", (route_id,))
        mysql.connection.commit()
        cur.close()
        
        return jsonify({"message": "Route deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Get available stations for dropdown
@routes_bp.route("/available-stations", methods=["GET"])
@jwt_required()
def get_available_stations():
    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        
        if not company_id:
            return jsonify([]), 200
        
        cur = mysql.connection.cursor()
        cur.execute("SELECT Station_ID, StationName FROM Station WHERE Company_ID=%s ORDER BY StationName", (company_id,))
        rows = cur.fetchall()
        cur.close()
        
        stations = [{"station_id": r[0], "station_name": r[1]} for r in rows]
        return jsonify(stations), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ===========================
# ROUTE STATIONS CRUD
# ===========================

# Get stations for a route
@routes_bp.route("/stations/<route_id>", methods=["GET"])
@jwt_required()
def get_route_stations(route_id):
    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        
        if not company_id:
            return jsonify([]), 200

        cur = mysql.connection.cursor()
        
        # Verify route belongs to admin's company
        cur.execute("SELECT Route_ID FROM Route WHERE Route_ID=%s AND Company_ID=%s", (route_id, company_id))
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "Route not found or access denied"}), 404

        cur.execute("""
            SELECT RouteStation_ID, Route_ID, Station_ID, StationName, StopOrder
            FROM RouteStations
            WHERE Route_ID=%s
            ORDER BY StopOrder ASC
        """, (route_id,))
        rows = cur.fetchall()
        cur.close()

        stations = []
        for r in rows:
            stations.append({
                "route_station_id": r[0],
                "route_id": r[1],
                "station_id": r[2],
                "station_name": r[3],
                "stop_order": r[4],
            })

        return jsonify(stations), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Add a station to a route
@routes_bp.route("/stations", methods=["POST"])
@jwt_required()
def add_route_station():
    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        
        if not company_id:
            return jsonify({"error": "Company not found for admin"}), 400

        data = request.get_json()
        route_id = data.get("route_id")
        station_id = data.get("station_id")
        stop_order = data.get("stop_order")

        if not route_id or not station_id or stop_order is None:
            return jsonify({"error": "Missing required fields: route_id, station_id, stop_order"}), 400

        cur = mysql.connection.cursor()
        
        # Verify route belongs to admin's company
        cur.execute("SELECT Route_ID FROM Route WHERE Route_ID=%s AND Company_ID=%s", (route_id, company_id))
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "Route not found or access denied"}), 404

        # Verify station exists and belongs to same company
        cur.execute("SELECT StationName FROM Station WHERE Station_ID=%s AND Company_ID=%s", (station_id, company_id))
        station_row = cur.fetchone()
        if not station_row:
            cur.close()
            return jsonify({"error": "Station not found or access denied"}), 404

        station_name = station_row[0]

        # Check if station already exists in this route
        cur.execute("SELECT RouteStation_ID FROM RouteStations WHERE Route_ID=%s AND Station_ID=%s", (route_id, station_id))
        if cur.fetchone():
            cur.close()
            return jsonify({"error": "Station already exists in this route"}), 400

        # Check if stop_order already exists in this route
        cur.execute("SELECT RouteStation_ID FROM RouteStations WHERE Route_ID=%s AND StopOrder=%s", (route_id, stop_order))
        if cur.fetchone():
            cur.close()
            return jsonify({"error": "Stop order already exists in this route"}), 400

        route_station_id = generate_route_station_id()

        cur.execute("""
            INSERT INTO RouteStations (RouteStation_ID, Route_ID, Station_ID, StationName, StopOrder)
            VALUES (%s, %s, %s, %s, %s)
        """, (route_station_id, route_id, station_id, station_name, stop_order))
        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Station added to route", "route_station_id": route_station_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Update a route station
@routes_bp.route("/stations/<route_station_id>", methods=["PUT"])
@jwt_required()
def update_route_station(route_station_id):
    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        
        if not company_id:
            return jsonify({"error": "Company not found for admin"}), 400

        data = request.get_json()
        stop_order = data.get("stop_order")

        cur = mysql.connection.cursor()
        
        # Verify route station belongs to admin's company
        cur.execute("""
            SELECT rs.Route_ID, rs.StopOrder
            FROM RouteStations rs
            JOIN Route r ON rs.Route_ID = r.Route_ID
            WHERE rs.RouteStation_ID=%s AND r.Company_ID=%s
        """, (route_station_id, company_id))
        route_station_row = cur.fetchone()
        
        if not route_station_row:
            cur.close()
            return jsonify({"error": "Route station not found or access denied"}), 404

        route_id, current_stop_order = route_station_row

        if stop_order is None:
            cur.close()
            return jsonify({"error": "No fields to update"}), 400

        # Check if new stop_order conflicts with existing ones (excluding current)
        cur.execute("""
            SELECT RouteStation_ID FROM RouteStations 
            WHERE Route_ID=%s AND StopOrder=%s AND RouteStation_ID!=%s
        """, (route_id, stop_order, route_station_id))
        if cur.fetchone():
            cur.close()
            return jsonify({"error": "Stop order already exists in this route"}), 400

        cur.execute("UPDATE RouteStations SET StopOrder=%s WHERE RouteStation_ID=%s", (stop_order, route_station_id))
        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Route station updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Delete a route station
@routes_bp.route("/stations/<route_station_id>", methods=["DELETE"])
@jwt_required()
def delete_route_station(route_station_id):
    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        
        if not company_id:
            return jsonify({"error": "Company not found for admin"}), 400

        cur = mysql.connection.cursor()
        
        # Verify route station belongs to admin's company
        cur.execute("""
            SELECT rs.RouteStation_ID
            FROM RouteStations rs
            JOIN Route r ON rs.Route_ID = r.Route_ID
            WHERE rs.RouteStation_ID=%s AND r.Company_ID=%s
        """, (route_station_id, company_id))
        
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "Route station not found or access denied"}), 404

        cur.execute("DELETE FROM RouteStations WHERE RouteStation_ID=%s", (route_station_id,))
        mysql.connection.commit()
        cur.close()
        
        return jsonify({"message": "Route station deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
