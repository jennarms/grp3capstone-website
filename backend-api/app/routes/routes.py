from flask import Blueprint, request, jsonify
from app import mysql
from flask_jwt_extended import jwt_required, get_jwt_identity

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

def get_company_id_for_admin(admin_id):
    cur = mysql.connection.cursor()
    cur.execute("SELECT Company_ID FROM MainAdmin WHERE Admin_ID=%s", (admin_id,))
    row = cur.fetchone()
    cur.close()
    return row[0] if row else None

# ===========================
# ROUTES CRUD
# ===========================

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
            SELECT Route_ID, Company_ID, Route_name, Water_flow, Vehicle_ID, is_active
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
                "vehicle_id": r[4],
                "is_active": bool(r[5]) if r[5] is not None else False
            })

        return jsonify(routes), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@routes_bp.route("/", methods=["POST"])
@jwt_required()
def create_route():
    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        if not company_id:
            return jsonify({"error": "Company not found"}), 400

        data = request.get_json()
        route_name = data.get("route_name")
        water_flow = data.get("water_flow")

        if not route_name:
            return jsonify({"error": "route_name is required"}), 400

        cur = mysql.connection.cursor()

        # Fetch first available vehicle
        cur.execute("SELECT Vehicle_ID FROM Vehicle LIMIT 1")
        vehicle_row = cur.fetchone()
        if not vehicle_row:
            cur.close()
            return jsonify({"error": "No vehicle found"}), 400

        vehicle_id = vehicle_row[0]

        # Check route limits based on water flow
        if water_flow in ['US', 'DS']:  # Water routes
            cur.execute("SELECT COUNT(*) FROM Route WHERE Company_ID=%s AND Water_flow IN ('US', 'DS')", (company_id,))
            water_count = cur.fetchone()[0]
            if water_count >= 2:
                cur.close()
                return jsonify({"error": "Maximum of 2 water routes allowed"}), 400
        else:  # Land routes
            cur.execute("SELECT COUNT(*) FROM Route WHERE Company_ID=%s AND (Water_flow IS NULL OR Water_flow = '')", (company_id,))
            land_count = cur.fetchone()[0]
            if land_count >= 1:
                cur.close()
                return jsonify({"error": "Maximum of 1 land route allowed"}), 400

        route_id = generate_route_id(company_id)
        
        # Insert route with Vehicle_ID
        cur.execute("""
            INSERT INTO Route (Route_ID, Company_ID, Route_name, Water_flow, Vehicle_ID, is_active)
            VALUES (%s, %s, %s, %s, %s, FALSE)
        """, (route_id, company_id, route_name, water_flow, vehicle_id))
        mysql.connection.commit()
        cur.close()

        return jsonify({
            "message": "Route created successfully",
            "route_id": route_id,
            "vehicle_id": vehicle_id
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@routes_bp.route("/<route_id>", methods=["PUT"])
@jwt_required()
def update_route(route_id):
    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        if not company_id:
            return jsonify({"error": "Company not found"}), 400

        data = request.get_json()
        route_name = data.get("route_name")
        water_flow = data.get("water_flow")

        if not route_name:
            return jsonify({"error": "route_name is required"}), 400

        cur = mysql.connection.cursor()
        
        # Check if route belongs to admin's company
        cur.execute("SELECT Route_ID FROM Route WHERE Route_ID=%s AND Company_ID=%s", (route_id, company_id))
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "Route not found or access denied"}), 404

        # Update the route
        cur.execute("""
            UPDATE Route 
            SET Route_name=%s, Water_flow=%s 
            WHERE Route_ID=%s AND Company_ID=%s
        """, (route_name, water_flow, route_id, company_id))
        mysql.connection.commit()
        cur.close()

        return jsonify({"message": "Route updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@routes_bp.route("/<route_id>", methods=["DELETE"])
@jwt_required()
def delete_route(route_id):
    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        if not company_id:
            return jsonify({"error": "Company not found"}), 400

        cur = mysql.connection.cursor()
        
        # Check if route belongs to admin's company
        cur.execute("SELECT Route_ID FROM Route WHERE Route_ID=%s AND Company_ID=%s", (route_id, company_id))
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "Route not found"}), 404

        # Delete route stations first
        cur.execute("DELETE FROM RouteStations WHERE Route_ID=%s", (route_id,))
        # Delete the route
        cur.execute("DELETE FROM Route WHERE Route_ID=%s", (route_id,))
        mysql.connection.commit()
        cur.close()
        
        return jsonify({"message": "Route deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ===========================
# ACTIVE ROUTE
# ===========================

@routes_bp.route("/<route_id>/set-active", methods=["PUT"])
@jwt_required()
def set_active_route(route_id):
    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        if not company_id:
            return jsonify({"error": "Company not found"}), 400

        cur = mysql.connection.cursor()
        
        # Check if route exists and belongs to company
        cur.execute("SELECT Route_ID, Route_name FROM Route WHERE Route_ID=%s AND Company_ID=%s", (route_id, company_id))
        route_row = cur.fetchone()
        if not route_row:
            cur.close()
            return jsonify({"error": "Route not found"}), 404

        # Set all routes inactive for this company
        cur.execute("UPDATE Route SET is_active=FALSE WHERE Company_ID=%s", (company_id,))
        # Set selected route active
        cur.execute("UPDATE Route SET is_active=TRUE WHERE Route_ID=%s AND Company_ID=%s", (route_id, company_id))
        mysql.connection.commit()
        
        # Return the active route data
        cur.execute("""
            SELECT Route_ID, Route_name, Water_flow, Vehicle_ID
            FROM Route
            WHERE Route_ID=%s AND Company_ID=%s
        """, (route_id, company_id))
        active_route = cur.fetchone()
        cur.close()

        return jsonify({
            "route_id": active_route[0],
            "route_name": active_route[1],
            "water_flow": active_route[2],
            "vehicle_id": active_route[3]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@routes_bp.route("/active", methods=["GET"])
@jwt_required()
def get_active_route():
    try:
        admin_id = get_jwt_identity()
        company_id = get_company_id_for_admin(admin_id)
        if not company_id:
            return jsonify({}), 200

        cur = mysql.connection.cursor()
        cur.execute("""
            SELECT Route_ID, Route_name, Water_flow, Vehicle_ID
            FROM Route
            WHERE Company_ID=%s AND is_active=TRUE
            LIMIT 1
        """, (company_id,))
        row = cur.fetchone()
        cur.close()

        if not row:
            return jsonify({}), 200

        return jsonify({
            "route_id": row[0],
            "route_name": row[1],
            "water_flow": row[2],
            "vehicle_id": row[3]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ===========================
# AVAILABLE STATIONS
# ===========================

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

@routes_bp.route("/stations/<route_id>", methods=["GET"])
@jwt_required()
def get_route_stations(route_id):
    try:
        cur = mysql.connection.cursor()
        cur.execute("""
            SELECT rs.RouteStation_ID, rs.Route_ID, rs.Station_ID, s.StationName, rs.StopOrder
            FROM RouteStations rs
            LEFT JOIN Station s ON rs.Station_ID = s.Station_ID
            WHERE rs.Route_ID=%s
            ORDER BY rs.StopOrder
        """, (route_id,))
        rows = cur.fetchall()
        cur.close()

        stations = []
        for r in rows:
            stations.append({
                "route_station_id": r[0],
                "route_id": r[1],
                "station_id": r[2],
                "station_name": r[3] or "Unknown Station",
                "stop_order": r[4]
            })
        return jsonify(stations), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@routes_bp.route("/stations", methods=["POST"])
@jwt_required()
def add_route_station():
    try:
        data = request.get_json()
        route_id = data.get("route_id")
        station_id = data.get("station_id")
        stop_order = data.get("stop_order")
        
        if not route_id or not station_id or not stop_order:
            return jsonify({"error": "Missing fields"}), 400

        cur = mysql.connection.cursor()
        
        # Get station name
        cur.execute("SELECT StationName FROM Station WHERE Station_ID=%s", (station_id,))
        station_row = cur.fetchone()
        if not station_row:
            cur.close()
            return jsonify({"error": "Station not found"}), 404
        
        station_name = station_row[0]
        
        # Generate RouteStation ID
        cur.execute("SELECT RouteStation_ID FROM RouteStations WHERE RouteStation_ID REGEXP '^RS[0-9]+$' ORDER BY RouteStation_ID DESC LIMIT 1")
        last_id = cur.fetchone()
        if last_id:
            last_num = int(last_id[0][2:])
            new_num = last_num + 1
        else:
            new_num = 1
        route_station_id = f"RS{new_num:03d}"
        
        cur.execute("""
            INSERT INTO RouteStations (RouteStation_ID, Route_ID, Station_ID, StationName, StopOrder)
            VALUES (%s, %s, %s, %s, %s)
        """, (route_station_id, route_id, station_id, station_name, stop_order))
        mysql.connection.commit()
        cur.close()
        
        return jsonify({"message": "Station added to route", "route_station_id": route_station_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@routes_bp.route("/stations/<route_station_id>", methods=["PUT"])
@jwt_required()
def update_route_station(route_station_id):
    try:
        data = request.get_json()
        stop_order = data.get("stop_order")
        if stop_order is None:
            return jsonify({"error": "stop_order required"}), 400

        cur = mysql.connection.cursor()
        cur.execute("UPDATE RouteStations SET StopOrder=%s WHERE RouteStation_ID=%s", (stop_order, route_station_id))
        mysql.connection.commit()
        cur.close()
        return jsonify({"message": "Route station updated"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@routes_bp.route("/stations/<route_station_id>", methods=["DELETE"])
@jwt_required()
def delete_route_station(route_station_id):
    try:
        cur = mysql.connection.cursor()
        cur.execute("DELETE FROM RouteStations WHERE RouteStation_ID=%s", (route_station_id,))
        mysql.connection.commit()
        cur.close()
        return jsonify({"message": "Route station deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500