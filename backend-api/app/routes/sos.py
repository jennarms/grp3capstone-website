from flask import Blueprint, jsonify, request
from app import mysql

sos_bp = Blueprint('sos', __name__)

@sos_bp.route('', methods=['GET'])
def get_sos():
    """Get SOS alerts with optional status filter"""
    try:
        status = request.args.get('status')  # Get ?status=OPEN parameter
        
        cur = mysql.connection.cursor()
        
        if status:
            cur.execute("SELECT * FROM sos_alerts WHERE status = %s ORDER BY created_at DESC", (status,))
        else:
            cur.execute("SELECT * FROM sos_alerts ORDER BY created_at DESC")
        
        columns = [desc[0] for desc in cur.description]
        sos_alerts = [dict(zip(columns, row)) for row in cur.fetchall()]
        cur.close()
        
        return jsonify(sos_alerts), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sos_bp.route('/<int:sos_id>', methods=['GET'])
def get_sos_by_id(sos_id):
    """Get specific SOS alert by ID"""
    try:
        cur = mysql.connection.cursor()
        cur.execute("SELECT * FROM sos_alerts WHERE id = %s", (sos_id,))
        
        columns = [desc[0] for desc in cur.description]
        row = cur.fetchone()
        cur.close()
        
        if row:
            sos_alert = dict(zip(columns, row))
            return jsonify(sos_alert), 200
        else:
            return jsonify({'error': 'SOS alert not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500