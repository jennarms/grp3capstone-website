# app.py
import os
from app import create_app

app = create_app()

# Optional: simple root for quick sanity
@app.route("/")
def home():
    return "Backend is running!"

if __name__ == "__main__":
    # --- DEV ONLY: start your legacy polling thread locally ---
    # In production (Gunicorn on Render), DO NOT start threads here; use APScheduler or a worker.
    from threading import Thread
    from app.routes.boarding_passengertable import poll_for_new_bookings

    def start_polling():
        with app.app_context():
            # NOTE: If poll_for_new_bookings is an infinite loop, this will block forever.
            # That's fine for a dev thread, but in prod use APScheduler or a worker service.
            poll_for_new_bookings()

    thread = Thread(target=start_polling, daemon=True)
    thread.start()

    # Bind to PORT (Render sets this in env). Default to 5000 locally.
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
