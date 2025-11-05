from flask import Flask, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": [
            "https://grp3capstone-website-1.onrender.com",  # Replace with your actual frontend URL
            "http://localhost:5173"  # Keep this for local development
        ]
    }
})

@app.route('/')
def home():
    return jsonify({
        'message': 'Flask backend is running!',
        'status': 'OK', 
        'timestamp': datetime.utcnow().isoformat(),
        'endpoints': {
            'health_check': '/api/healthz',
            'users': '/api/users'
        }
    })
    
@app.route('/api/healthz', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'OK',
        'timestamp': datetime.utcnow().isoformat(),
        'service': 'flask-backend'
    }), 200

# Your existing routes below...
@app.route('/api/users')
def get_users():
    return jsonify({'users': []})

if __name__ == '__main__':
    app.run(debug=True)