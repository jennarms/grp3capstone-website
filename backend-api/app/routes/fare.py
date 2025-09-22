from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import mysql

fare_bp = Blueprint('fare_bp', __name__)

# ---- Sync stations from Station table to Station_Master table ----
@fare_bp.route('/stations/sync', methods=['POST'])
@jwt_required()
def sync_stations():
    cursor = mysql.connection.cursor()
    try:
        # Get all stations from the main Station table
        cursor.execute("""
            SELECT Station_ID, StationName 
            FROM Station 
            WHERE StationName IS NOT NULL AND StationName != ''
        """)
        stations = cursor.fetchall()
        
        if not stations:
            return jsonify({"error": "No stations found in Station table"}), 400
        
        synced_count = 0
        for station in stations:
            station_id = station[0]
            station_name = station[1]
            
            # Check if station already exists in Station_Master
            cursor.execute("""
                SELECT Station_ID FROM Station_Master WHERE Station_ID = %s
            """, (station_id,))
            
            if not cursor.fetchone():
                # Insert new station with auto-incremented stop order
                cursor.execute("""
                    SELECT COALESCE(MAX(StopOrder), 0) + 1 FROM Station_Master
                """)
                next_order = cursor.fetchone()[0]
                
                cursor.execute("""
                    INSERT INTO Station_Master (Station_ID, StationName, StopOrder, Active)
                    VALUES (%s, %s, %s, 1)
                """, (station_id, station_name, next_order))
                synced_count += 1
        
        mysql.connection.commit()
        return jsonify({
            "message": f"Successfully synced {synced_count} stations to Station_Master",
            "total_stations_found": len(stations)
        })
    except Exception as e:
        mysql.connection.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()

# ---- Fetch Station Master with debug info ----
@fare_bp.route('/stations', methods=['GET'])
@jwt_required()
def get_station_master():
    cursor = mysql.connection.cursor()
    try:
        # First check if Station_Master table has data
        cursor.execute("SELECT COUNT(*) FROM Station_Master")
        count = cursor.fetchone()[0]
        
        if count == 0:
            # Check if Station table has data
            cursor.execute("SELECT COUNT(*) FROM Station WHERE StationName IS NOT NULL")
            station_count = cursor.fetchone()[0]
            
            return jsonify({
                "stations": [],
                "debug_info": {
                    "station_master_count": 0,
                    "main_station_count": station_count,
                    "message": "Station_Master table is empty. Use /sync endpoint to populate it."
                }
            })
        
        cursor.execute("""
            SELECT Station_ID, StationName, StopOrder, Active
            FROM Station_Master
            ORDER BY StopOrder ASC
        """)
        stations = cursor.fetchall()
        result = [{
            "Station_ID": row[0],
            "StationName": row[1],
            "StopOrder": row[2],
            "Active": bool(row[3])
        } for row in stations]
        
        return jsonify({
            "stations": result,
            "debug_info": {
                "station_master_count": len(result),
                "message": "Data loaded successfully"
            }
        })
    except Exception as e:
        return jsonify({"error": str(e), "debug_info": {"message": "Database error"}}), 500
    finally:
        cursor.close()

# ---- Update station order ----
@fare_bp.route('/stations/order', methods=['PUT'])
@jwt_required()
def update_station_order():
    data = request.json
    stations_order = data.get("stations")  # Expected format: [{"Station_ID": "ST001", "StopOrder": 1}, ...]
    
    if not stations_order:
        return jsonify({"error": "Stations order data required"}), 400

    cursor = mysql.connection.cursor()
    try:
        for station in stations_order:
            cursor.execute("""
                UPDATE Station_Master 
                SET StopOrder = %s 
                WHERE Station_ID = %s
            """, (station["StopOrder"], station["Station_ID"]))
        
        mysql.connection.commit()
        return jsonify({"message": "Station order updated successfully"})
    except Exception as e:
        mysql.connection.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()

# ---- Update station active status ----
@fare_bp.route('/stations/<station_id>/status', methods=['PUT'])
@jwt_required()
def update_station_status(station_id):
    data = request.json
    active = data.get("Active")
    
    if active is None:
        return jsonify({"error": "Active status required"}), 400

    cursor = mysql.connection.cursor()
    try:
        cursor.execute("""
            UPDATE Station_Master 
            SET Active = %s 
            WHERE Station_ID = %s
        """, (int(active), station_id))
        
        mysql.connection.commit()
        return jsonify({"message": "Station status updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()

# ---- Fetch full fare matrix ----
@fare_bp.route('/matrix', methods=['GET'])
@jwt_required()
def get_fare_matrix():
    cursor = mysql.connection.cursor()
    try:
        cursor.execute("""
            SELECT f.Fare_ID, f.From_Station_ID, f.To_Station_ID, f.Fare, f.Active,
                   s_from.StationName AS FromName, s_to.StationName AS ToName,
                   s_from.StopOrder AS FromOrder, s_to.StopOrder AS ToOrder
            FROM Fare f
            JOIN Station_Master s_from ON f.From_Station_ID = s_from.Station_ID
            JOIN Station_Master s_to ON f.To_Station_ID = s_to.Station_ID
            WHERE s_from.Active = 1 AND s_to.Active = 1
            ORDER BY s_from.StopOrder, s_to.StopOrder
        """)
        fares = cursor.fetchall()
        result = [{
            "Fare_ID": row[0],
            "From_Station_ID": row[1],
            "To_Station_ID": row[2],
            "Fare": float(row[3]),
            "Active": bool(row[4]),
            "FromName": row[5],
            "ToName": row[6],
            "FromOrder": row[7],
            "ToOrder": row[8]
        } for row in fares]
        return jsonify(result)
    finally:
        cursor.close()

# ---- Get fare matrix for specific route (optional endpoint for future use) ----
@fare_bp.route('/matrix/route/<from_station>/<to_station>', methods=['GET'])
@jwt_required()
def get_route_fare(from_station, to_station):
    cursor = mysql.connection.cursor()
    try:
        cursor.execute("""
            SELECT f.Fare_ID, f.From_Station_ID, f.To_Station_ID, f.Fare, f.Active,
                   s_from.StationName AS FromName, s_to.StationName AS ToName
            FROM Fare f
            JOIN Station_Master s_from ON f.From_Station_ID = s_from.Station_ID
            JOIN Station_Master s_to ON f.To_Station_ID = s_to.Station_ID
            WHERE f.From_Station_ID = %s AND f.To_Station_ID = %s
        """, (from_station, to_station))
        fare = cursor.fetchone()
        
        if not fare:
            return jsonify({"error": "Fare not found for this route"}), 404
            
        result = {
            "Fare_ID": fare[0],
            "From_Station_ID": fare[1],
            "To_Station_ID": fare[2],
            "Fare": float(fare[3]),
            "Active": bool(fare[4]),
            "FromName": fare[5],
            "ToName": fare[6]
        }
        return jsonify(result)
    finally:
        cursor.close()

# ---- Update fare value ----
@fare_bp.route('/update/<int:fare_id>', methods=['PUT'])
@jwt_required()
def update_fare(fare_id):
    data = request.json
    new_fare = data.get("Fare")
    active = data.get("Active")

    if new_fare is None and active is None:
        return jsonify({"error": "Nothing to update"}), 400

    cursor = mysql.connection.cursor()
    try:
        # Check if fare exists
        cursor.execute("SELECT Fare_ID FROM Fare WHERE Fare_ID = %s", (fare_id,))
        if not cursor.fetchone():
            return jsonify({"error": "Fare not found"}), 404

        # Update fare
        if new_fare is not None and active is not None:
            cursor.execute("""
                UPDATE Fare SET Fare=%s, Active=%s WHERE Fare_ID=%s
            """, (new_fare, int(active), fare_id))
        elif new_fare is not None:
            cursor.execute("""
                UPDATE Fare SET Fare=%s WHERE Fare_ID=%s
            """, (new_fare, fare_id))
        elif active is not None:
            cursor.execute("""
                UPDATE Fare SET Active=%s WHERE Fare_ID=%s
            """, (int(active), fare_id))

        mysql.connection.commit()
        return jsonify({"message": "Fare updated successfully"})
    except Exception as e:
        mysql.connection.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()

# ---- Bulk update fares ----
@fare_bp.route('/update/bulk', methods=['PUT'])
@jwt_required()
def bulk_update_fares():
    data = request.json
    fares = data.get("fares", [])
    
    if not fares:
        return jsonify({"error": "No fares provided"}), 400
    
    cursor = mysql.connection.cursor()
    try:
        updated_count = 0
        for fare in fares:
            fare_id = fare.get("Fare_ID")
            new_fare = fare.get("Fare")
            active = fare.get("Active")
            
            if fare_id is None:
                continue
                
            # Build update query dynamically based on provided fields
            update_fields = []
            update_values = []
            
            if new_fare is not None:
                update_fields.append("Fare = %s")
                update_values.append(float(new_fare))
            
            if active is not None:
                update_fields.append("Active = %s")
                update_values.append(int(active))
            
            if update_fields:
                update_values.append(fare_id)
                query = f"UPDATE Fare SET {', '.join(update_fields)} WHERE Fare_ID = %s"
                cursor.execute(query, update_values)
                updated_count += 1
        
        mysql.connection.commit()
        return jsonify({
            "message": f"Successfully updated {updated_count} fares",
            "updated_count": updated_count
        })
        
    except Exception as e:
        mysql.connection.rollback()
        print(f"Error in bulk_update_fares: {str(e)}")  # For debugging
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    finally:
        cursor.close()
        
# ---- Regenerate all fares from Station_Master ----
@fare_bp.route('/regenerate', methods=['POST'])
@jwt_required()
def regenerate_fares():
    cursor = mysql.connection.cursor()
    try:
        # First, get all active stations ordered by StopOrder
        cursor.execute("""
            SELECT Station_ID, StationName, StopOrder 
            FROM Station_Master 
            WHERE Active=1 
            ORDER BY StopOrder ASC
        """)
        stations = cursor.fetchall()
        
        if not stations:
            return jsonify({"error": "No active stations found"}), 400
        
        station_ids = [station[0] for station in stations]
        new_fares_created = 0
        
        # Create all possible combinations (from each station to every other station)
        for i, from_station in enumerate(station_ids):
            for j, to_station in enumerate(station_ids):
                # Skip same station combinations
                if from_station == to_station:
                    continue
                
                # Check if fare already exists
                cursor.execute("""
                    SELECT Fare_ID FROM Fare 
                    WHERE From_Station_ID = %s AND To_Station_ID = %s
                """, (from_station, to_station))
                
                existing_fare = cursor.fetchone()
                
                # Only insert if it doesn't exist
                if not existing_fare:
                    cursor.execute("""
                        INSERT INTO Fare (From_Station_ID, To_Station_ID, Fare, Active)
                        VALUES (%s, %s, 0.00, 1)
                    """, (from_station, to_station))
                    new_fares_created += 1
        
        # Commit all changes
        mysql.connection.commit()
        
        return jsonify({
            "message": "Fare matrix regenerated successfully",
            "new_fares_created": new_fares_created,
            "total_stations": len(stations),
            "possible_combinations": len(station_ids) * (len(station_ids) - 1)
        })
        
    except Exception as e:
        mysql.connection.rollback()
        print(f"Error in regenerate_fares: {str(e)}")  # For debugging
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    finally:
        cursor.close()

# ---- Delete fare (soft delete by setting Active = 0) ----
@fare_bp.route('/delete/<int:fare_id>', methods=['DELETE'])
@jwt_required()
def delete_fare(fare_id):
    cursor = mysql.connection.cursor()
    try:
        # Check if fare exists
        cursor.execute("SELECT Fare_ID FROM Fare WHERE Fare_ID = %s", (fare_id,))
        if not cursor.fetchone():
            return jsonify({"error": "Fare not found"}), 404

        # Soft delete by setting Active = 0
        cursor.execute("""
            UPDATE Fare SET Active = 0 WHERE Fare_ID = %s
        """, (fare_id,))

        mysql.connection.commit()
        return jsonify({"message": "Fare deleted successfully"})
    except Exception as e:
        mysql.connection.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()

# ---- Get fare statistics ----
@fare_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_fare_stats():
    cursor = mysql.connection.cursor()
    try:
        # Get total number of stations
        cursor.execute("SELECT COUNT(*) FROM Station_Master WHERE Active = 1")
        total_stations = cursor.fetchone()[0]

        # Get total number of fare entries
        cursor.execute("SELECT COUNT(*) FROM Fare WHERE Active = 1")
        total_fares = cursor.fetchone()[0]

        # Get average fare
        cursor.execute("SELECT AVG(Fare) FROM Fare WHERE Active = 1 AND Fare > 0")
        avg_fare_result = cursor.fetchone()[0]
        avg_fare = float(avg_fare_result) if avg_fare_result else 0

        # Get min and max fares
        cursor.execute("SELECT MIN(Fare), MAX(Fare) FROM Fare WHERE Active = 1 AND Fare > 0")
        min_max_result = cursor.fetchone()
        min_fare = float(min_max_result[0]) if min_max_result[0] else 0
        max_fare = float(min_max_result[1]) if min_max_result[1] else 0

        # Get number of zero fares (unset fares)
        cursor.execute("SELECT COUNT(*) FROM Fare WHERE Active = 1 AND Fare = 0")
        zero_fares = cursor.fetchone()[0]

        result = {
            "total_stations": total_stations,
            "total_fares": total_fares,
            "average_fare": round(avg_fare, 2),
            "min_fare": min_fare,
            "max_fare": max_fare,
            "unset_fares": zero_fares,
            "possible_routes": total_stations * (total_stations - 1) if total_stations > 1 else 0
        }
        return jsonify(result)
    finally:
        cursor.close()

# ---- Export fare matrix as JSON ----
@fare_bp.route('/export', methods=['GET'])
@jwt_required()
def export_fare_matrix():
    cursor = mysql.connection.cursor()
    try:
        # Get all stations
        cursor.execute("""
            SELECT Station_ID, StationName, StopOrder, Active
            FROM Station_Master
            ORDER BY StopOrder ASC
        """)
        stations = cursor.fetchall()

        # Get all fares
        cursor.execute("""
            SELECT f.Fare_ID, f.From_Station_ID, f.To_Station_ID, f.Fare, f.Active,
                   s_from.StationName AS FromName, s_to.StationName AS ToName
            FROM Fare f
            JOIN Station_Master s_from ON f.From_Station_ID = s_from.Station_ID
            JOIN Station_Master s_to ON f.To_Station_ID = s_to.Station_ID
            ORDER BY s_from.StopOrder, s_to.StopOrder
        """)
        fares = cursor.fetchall()

        # Format export data
        export_data = {
            "export_timestamp": "now",  # You can format this properly
            "stations": [{
                "Station_ID": row[0],
                "StationName": row[1],
                "StopOrder": row[2],
                "Active": bool(row[3])
            } for row in stations],
            "fares": [{
                "Fare_ID": row[0],
                "From_Station_ID": row[1],
                "To_Station_ID": row[2],
                "Fare": float(row[3]),
                "Active": bool(row[4]),
                "FromName": row[5],
                "ToName": row[6]
            } for row in fares]
        }

        return jsonify(export_data)
    finally:
        cursor.close()

# ---- Health check endpoint ----
@fare_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "fare_management",
        "version": "1.0.0"
    })

# ---- Debug endpoint to check both tables ----
@fare_bp.route('/debug', methods=['GET'])
@jwt_required()
def debug_tables():
    cursor = mysql.connection.cursor()
    try:
        # Check Station table
        cursor.execute("SELECT COUNT(*) FROM Station WHERE StationName IS NOT NULL")
        station_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT Station_ID, StationName FROM Station WHERE StationName IS NOT NULL LIMIT 5")
        sample_stations = cursor.fetchall()
        
        # Check Station_Master table
        cursor.execute("SELECT COUNT(*) FROM Station_Master")
        station_master_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT Station_ID, StationName, StopOrder FROM Station_Master LIMIT 5")
        sample_station_master = cursor.fetchall()
        
        # Check Fare table
        cursor.execute("SELECT COUNT(*) FROM Fare")
        fare_count = cursor.fetchone()[0]
        
        return jsonify({
            "station_table": {
                "count": station_count,
                "sample": [{"Station_ID": row[0], "StationName": row[1]} for row in sample_stations]
            },
            "station_master_table": {
                "count": station_master_count,
                "sample": [{"Station_ID": row[0], "StationName": row[1], "StopOrder": row[2]} for row in sample_station_master]
            },
            "fare_table": {
                "count": fare_count
            }
        })
    finally:
        cursor.close()