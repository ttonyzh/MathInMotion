from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import logging
import subprocess
import base64
from .docker_manim_renderer import DockerManimRenderer

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

# Initialize the Docker-based Manim renderer
manim_renderer = DockerManimRenderer(MEDIA_DIR)

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
        
        if not manim_code:
            logger.error("No Manim code provided")
            return jsonify({'error': 'No Manim code provided'}), 400
        
        logger.info("Received Manim code for rendering")

        render_result = manim_renderer.render_manim_code(manim_code)

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
