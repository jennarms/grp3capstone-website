from flask import Flask, jsonify
from flask_cors import CORS  # 🔁 Import CORS

app = Flask(__name__)
CORS(app)  # 🔁 Enable CORS so React can call Flask

@app.route('/api/hello')
def hello():
    return jsonify(message='Hello from Flask!')

if __name__ == '__main__':
    app.run(debug=True)
