from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import uuid
import json
import base64
import re
from pathlib import Path

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Create a directory for storing generated media
MEDIA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'media')
os.makedirs(MEDIA_DIR, exist_ok=True)

def extract_equations_and_text(manim_code):
    """Extract equations and explanatory text from the Manim code"""
    equations = []
    explanations = []
    
    # Look for MathTex or Tex objects
    math_pattern = r'MathTex\(["\']([^"\']*)["\'](,\s*font_size=\d+)?\)'
    for match in re.finditer(math_pattern, manim_code):
        equations.append(match.group(1))
    
    # Look for Text objects that might be explanations
    text_pattern = r'Text\(["\']([^"\']*)["\'](,\s*font_size=\d+)?\)'
    for match in re.finditer(text_pattern, manim_code):
        explanations.append(match.group(1))
    
    return equations, explanations

def create_html_visualization(equations, explanations):
    """Create an HTML visualization based on extracted content"""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>STEM Problem Visualization</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f0f4f8;
                color: #333;
            }
            .container {
                width: 100%;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                background-color: white;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                box-sizing: border-box;
            }
            h1 {
                color: #2c3e50;
                text-align: center;
                margin-bottom: 20px;
                font-size: 24px;
            }
            h2 {
                color: #3498db;
                margin-top: 25px;
                font-size: 20px;
            }
            .equation {
                font-family: 'Times New Roman', serif;
                font-size: 22px;
                text-align: center;
                margin: 15px 0;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 4px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            .explanation {
                margin: 15px 0;
                padding: 12px 15px;
                background-color: #e3f2fd;
                border-left: 4px solid #2196f3;
                border-radius: 4px;
                line-height: 1.5;
            }
            .divider {
                height: 2px;
                background-color: #3498db;
                width: 60%;
                margin: 25px auto;
            }
            .animation-container {
                margin: 20px 0;
                text-align: center;
            }
        </style>
        <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
        <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    </head>
    <body>
        <div class="container">
            <h1>STEM Problem Solution</h1>
    """
    
    # Add equations with MathJax formatting
    if equations:
        html += "<h2>Key Equations:</h2>\n"
        for eq in equations:
            html += f"<div class='equation'>\\({eq}\\)</div>\n"
    
    # Add divider
    html += "<div class='divider'></div>\n"
    
    # Add explanations
    if explanations:
        html += "<h2>Explanation:</h2>\n"
        for exp in explanations:
            html += f"<div class='explanation'>{exp}</div>\n"
    
    # Close HTML
    html += """
        </div>
    </body>
    </html>
    """
    
    return html

@app.route('/render-manim', methods=['POST'])
def render_manim():
    try:
        data = request.json
        manim_code = data.get('manimCode')
        
        if not manim_code:
            return jsonify({'error': 'No code provided'}), 400
        
        # Create a unique ID for this rendering
        render_id = str(uuid.uuid4())
        
        # Create a directory for this render
        render_dir = os.path.join(MEDIA_DIR, render_id)
        os.makedirs(render_dir, exist_ok=True)
        
        # Extract equations and explanations from the code
        equations, explanations = extract_equations_and_text(manim_code)
        
        # Create an HTML visualization
        html_content = create_html_visualization(equations, explanations)
        
        # Save the HTML
        html_path = os.path.join(render_dir, 'visualization.html')
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        # Convert the HTML to base64
        html_base64 = base64.b64encode(html_content.encode('utf-8')).decode('utf-8')
        
        return jsonify({
            'success': True,
            'renderId': render_id,
            'videoBase64': html_base64,
            'contentType': 'text/html'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/media/<render_id>/<filename>', methods=['GET'])
def get_media(render_id, filename):
    """Serve generated media files"""
    media_path = os.path.join(MEDIA_DIR, render_id, filename)
    return send_file(media_path)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)
