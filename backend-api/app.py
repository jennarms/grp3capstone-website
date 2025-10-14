from app import create_app
from app.routes.passengertable import poll_for_new_bookings  # Import polling function
from threading import Thread

app = create_app()

def start_polling():
    # Start polling in the background thread after the app is created and context is available
    with app.app_context():  # Make sure the app context is available for the background thread
        poll_for_new_bookings()

# Start polling after the app is created
thread = Thread(target=start_polling)
thread.daemon = True  # Ensure it runs as a daemon thread
thread.start()

@app.route('/')
def home():
    return "Backend is running!"

if __name__ == '__main__':
    app.run(debug=True)
