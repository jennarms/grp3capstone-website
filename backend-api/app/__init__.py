from flask import Flask
from flask_cors import CORS
from flask_mysqldb import MySQL
from flask_mail import Mail
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os

# Global extension instances
mysql = MySQL()
mail = Mail()
jwt = JWTManager()

def create_app():
    app = Flask(__name__)

    # ✅ Allow CORS for React frontend
    CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}}, supports_credentials=True)

    # Load environment variables
    load_dotenv()

    # MySQL Config
    app.config['MYSQL_HOST'] = os.getenv('DB_HOST')
    app.config['MYSQL_USER'] = os.getenv('DB_USER')
    app.config['MYSQL_PASSWORD'] = os.getenv('DB_PASSWORD')
    app.config['MYSQL_DB'] = os.getenv('DB_NAME')

    # Mail Config
    app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER')
    app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
    app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
    app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
    app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'False').lower() == 'true'
    app.config['MAIL_USE_SSL'] = os.getenv('MAIL_USE_SSL', 'False').lower() == 'true'

    # JWT Config
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'super-secret-key')

    # Initialize extensions
    mysql.init_app(app)
    mail.init_app(app)
    jwt.init_app(app)

    # Register routes with /api prefix
    from app.routes.auth import auth
    app.register_blueprint(auth, url_prefix="/api/auth")

    from app.routes.accountSettings import account_settings_bp
    app.register_blueprint(account_settings_bp, url_prefix="/api/account")

    from app.routes.announcement import announcement_bp
    app.register_blueprint(announcement_bp, url_prefix="/api/announcement")

    from app.routes.faqs import faqs_bp
    app.register_blueprint(faqs_bp, url_prefix="/api/faqs")

    from app.routes.passengerManagement import passenger_bp
    app.register_blueprint(passenger_bp, url_prefix="/api/users")

    from app.routes.feedback import feedback_bp
    app.register_blueprint(feedback_bp, url_prefix="/api/feedback")

    from app.routes.vehicle import vehicle_bp
    app.register_blueprint(vehicle_bp, url_prefix="/api/vehicle")

    return app
