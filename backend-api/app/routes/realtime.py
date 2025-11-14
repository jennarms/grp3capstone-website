from flask import Blueprint, Response, stream_with_context
import json
import time

realtime_bp = Blueprint('realtime', __name__)

@realtime_bp.route('/sos:<int:interval>', methods=['GET'])
def sos_stream(interval):
    """Server-Sent Events stream for SOS updates"""
    def generate():
        while True:
            # Query for SOS alerts
            # This is a simple example - adjust based on your needs
            yield f"data: {json.dumps({'status': 'checking'})}\n\n"
            time.sleep(interval)
    
    return Response(stream_with_context(generate()), 
                   mimetype='text/event-stream',
                   headers={
                       'Cache-Control': 'no-cache',
                       'X-Accel-Buffering': 'no'
                   })