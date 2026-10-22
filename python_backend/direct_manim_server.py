from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import sys
import logging
import subprocess
import base64
from .manim_renderer import ManimRenderer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rag.math_db import retrieve

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('direct_manim_server')

app = Flask(__name__)
# Configure CORS to allow requests from the Next.js development server
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000",
                    "http://localhost:3001", "http://127.0.0.1:3001"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Create a directory for storing media files
MEDIA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'media')
os.makedirs(MEDIA_DIR, exist_ok=True)

# Initialize the Manim renderer (runs Manim as a local subprocess)
manim_renderer = ManimRenderer(MEDIA_DIR)

# RAG knowledge base is populated by running rag/ingest_pauls_notes.py and
# rag/ingest_openstax.py once (not re-seeded on every server start).


@app.route('/rag-context', methods=['POST'])
def rag_context():
    """Return relevant textbook chunks for a given query."""
    try:
        data = request.json or {}
        query = data.get('query', '').strip()
        if not query:
            return jsonify({'success': False, 'error': 'No query provided'}), 400
        chunks = retrieve(query, n_results=3)
        return jsonify({'success': True, 'chunks': chunks})
    except Exception as e:
        logger.error(f"RAG retrieval error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/render-manim', methods=['POST', 'OPTIONS'])
def render_manim():
    """Render Manim code to a video and return it as base64."""
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = jsonify({'status': 'preflight'})
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        return response
        
    try:
        data = request.json
        if not data:
            logger.error("No JSON data received")
            return jsonify({'error': 'No data provided'}), 400
            
        manim_code = data.get('manimCode')
        voice      = data.get('voice', 'en-US-JennyNeural')

        if not manim_code:
            logger.error("No Manim code provided")
            return jsonify({'error': 'No Manim code provided'}), 400

        logger.info(f"Received Manim code for rendering (voice={voice})")

        render_result = manim_renderer.render_manim_code(manim_code, voice=voice)

        if not render_result['success']:
            error_msg = render_result.get('error', 'Unknown error during rendering')
            logger.error(f"Failed to render animation: {error_msg}")
            response = jsonify({
                'success': False,
                'error': error_msg
            })
            response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
            return response, 500

        video_path = render_result['video_path']
        logger.info(f"Successfully rendered video to: {video_path}")

        with open(video_path, 'rb') as f:
            video_base64 = base64.b64encode(f.read()).decode('utf-8')

        response = jsonify({
            'success': True,
            'videoBase64': video_base64,
            'message': 'Animation rendered successfully'
        })
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        return response
    
    except Exception as e:
        error_msg = f'Failed to render animation: {str(e)}'
        logger.error(error_msg, exc_info=True)
        response = jsonify({
            'success': False,
            'error': error_msg
        })
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        return response, 500

@app.route('/media/<path:filename>')
def serve_media(filename):
    """Serve media files with proper MIME types."""
    try:
        file_path = os.path.join(MEDIA_DIR, filename)
        if not os.path.isfile(file_path):
            logger.error(f"File not found: {file_path}")
            return jsonify({'error': 'File not found'}), 404
            
        # Set cache headers to prevent caching of media files
        response = send_file(file_path)
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        return response
    except Exception as e:
        logger.exception(f"Error serving file {filename}")
        return jsonify({'error': 'Failed to serve file'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint that verifies Docker is available."""
    try:
        # Check if Docker is running and accessible
        result = subprocess.run(
            ['docker', 'info'],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            response = jsonify({
                'status': 'unhealthy',
                'error': 'Docker is not running or accessible',
                'details': result.stderr
            })
            response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
            return response, 500
            
        response = jsonify({
            'status': 'healthy',
            'docker': 'available',
            'manim': 'ready'
        })
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        return response
    except Exception as e:
        response = jsonify({
            'status': 'unhealthy',
            'error': str(e)
        })
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        return response, 500

if __name__ == '__main__':
    logger.info("Starting Direct Manim Server")
    # Disable debug mode to prevent auto-reload during rendering
    app.run(host='0.0.0.0', port=5005, debug=False)
