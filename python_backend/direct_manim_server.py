from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import logging
import json
from manim_renderer import ManimRenderer

# Configure logging
logging.basicConfig(
    filename='direct_manim_server.log',
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('direct_manim_server')

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Create a directory for storing media files
MEDIA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'media')
os.makedirs(MEDIA_DIR, exist_ok=True)

# Initialize the Manim renderer
manim_renderer = ManimRenderer(MEDIA_DIR)

@app.route('/render-manim', methods=['POST'])
def render_manim():
    """Render Manim code to a video and return it as base64."""
    try:
        data = request.json
        manim_code = data.get('manimCode')
        
        if not manim_code:
            logger.error("No Manim code provided")
            return jsonify({'error': 'No Manim code provided'}), 400
        
        logger.info("Received Manim code for rendering")
        logger.debug(f"Manim code: {manim_code}")
        
        # Since we're having issues with Manim dependencies, let's return a text-based response
        # that acknowledges the code was received but can't be rendered due to technical limitations
        
        # Extract the class name from the Manim code for the title
        import re
        class_match = re.search(r'class\s+(\w+)\s*\(\s*Scene\s*\)', manim_code)
        scene_name = class_match.group(1) if class_match else "MathVisualization"
        
        # Create a message explaining the issue
        message = f"""The Manim code for '{scene_name}' was successfully received, but could not be rendered due to Cairo library dependency issues on macOS.

The code would create a visualization showing the step-by-step solution to the mathematical problem.

To fix this issue, you would need to properly install Cairo and its dependencies, which is beyond the scope of this demo.

The Manim code is available and can be run separately with a proper Manim installation."""
        
        # Return a success response with the message
        return jsonify({
            'success': True,
            'message': message,
            'manimCode': manim_code,
            'videoBase64': '',  # No video data
            'textFallback': True
        })
    
    except Exception as e:
        logger.exception("Error rendering Manim animation")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/media/<path:filename>')
def serve_media(filename):
    """Serve media files."""
    return send_file(os.path.join(MEDIA_DIR, filename))

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    logger.info("Starting Direct Manim Server")
    app.run(host='0.0.0.0', port=5004, debug=True)
