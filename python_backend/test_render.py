from manim_renderer import ManimRenderer
import os

# Initialize the renderer
media_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'media')
renderer = ManimRenderer(media_dir)

# Read the Manim code from the example file
with open('examples/pemdas_example.py', 'r') as f:
    manim_code = f.read()

# Render the animation and get the result
result = renderer.render_and_encode(manim_code)

# Print the result
print('Rendering complete! Video saved at:', result['video_path'])
print(f'Video base64 length: {len(result["video_base64"])} characters')
