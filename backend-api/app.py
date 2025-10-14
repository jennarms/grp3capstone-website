from flask import Flask, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS

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