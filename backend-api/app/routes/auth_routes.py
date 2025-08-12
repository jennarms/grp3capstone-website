from flask import Blueprint, jsonify
from app import mysql

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/test', methods=['GET'])
def test_route():
    return jsonify(message="Auth route works!")

@auth_bp.route('/db-test', methods=['GET'])
def db_test():
    cur = mysql.connection.cursor()
    cur.execute("SHOW TABLES;")  # This lists all tables in your database
    tables = cur.fetchall()
    cur.close()
    return jsonify(tables=tables)
