# In app.py (or run.py, where the app is run)
from app import create_app

app = create_app()  # Create the app using create_app()

@app.route('/')
def home():
    return "Backend is running!"

if __name__ == '__main__':
    app.run(debug=True)
