from flask import Flask
from flask_cors import CORS
from flask_mysqldb import MySQL
from dotenv import load_dotenv
import os

mysql = MySQL()

def create_app():
    app = Flask(__name__)
    CORS(app)

    # Load environment variables from .env
    load_dotenv()

    # MySQL Configuration (from .env)
    app.config['MYSQL_HOST'] = os.getenv('MYSQL_HOST')
    app.config['MYSQL_USER'] = os.getenv('MYSQL_USER')
    app.config['MYSQL_PASSWORD'] = os.getenv('MYSQL_PASSWORD')
    app.config['MYSQL_DB'] = os.getenv('MYSQL_DB')

    # Initialize MySQL
    mysql.init_app(app)

    # Register routes
    from app.routes.auth_routes import auth_bp
    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    return app
