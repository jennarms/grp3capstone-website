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

    # Load environment variables early
    load_dotenv()

    # ✅ Allow CORS for React frontend (both localhost + 127.0.0.1 just in case)
    CORS(
        app,
        resources={r"/api/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}},
        supports_credentials=True
    )

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
    app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER')

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

    from app.routes.station import station_bp
    app.register_blueprint(station_bp, url_prefix="/api/station")
    
    from app.routes.routes import routes_bp
    app.register_blueprint(routes_bp, url_prefix="/api/routes")

    from app.routes.schedules import schedules_bp   
    app.register_blueprint(schedules_bp, url_prefix="/api/schedules")

    from app.routes.fare import fare_bp
    app.register_blueprint(fare_bp, url_prefix="/api/fare")

    from app.routes.ui_customization import ui_bp
    app.register_blueprint(ui_bp, url_prefix="/api/ui")
    
    return app
