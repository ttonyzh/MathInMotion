import os
import tempfile
import uuid
import re
import base64
import subprocess
import logging
from pathlib import Path
import shutil

# Configure logging
logging.basicConfig(
    filename='manim_renderer.log',
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('manim_renderer')

class ManimRenderer:
    def __init__(self, media_dir=None):
        """Initialize the Manim renderer with a directory for storing media files."""
        if media_dir:
            self.media_dir = Path(media_dir)
        else:
            self.media_dir = Path(os.path.dirname(os.path.abspath(__file__))) / 'media'
        
        self.media_dir.mkdir(exist_ok=True)
        logger.info(f"Initialized ManimRenderer with media directory: {self.media_dir}")

    def detect_scene_class(self, manim_code):
        """Detect the scene class name from the Manim code."""
        # Look for a class that inherits from Scene
        scene_pattern = r'class\s+(\w+)\s*\(\s*Scene\s*\)'
        match = re.search(scene_pattern, manim_code)
        
        if match:
            scene_name = match.group(1)
            logger.info(f"Detected scene class: {scene_name}")
            return scene_name
        
        # If no scene class is found, we'll need to create one
        logger.info("No scene class detected, will create one")
        return None

    def ensure_scene_class(self, manim_code):
        """Ensure the code has a proper scene class, adding one if needed."""
        scene_name = self.detect_scene_class(manim_code)
        
        if scene_name:
            # Scene class already exists, return the original code and scene name
            return manim_code, scene_name
        
        # No scene class found, let's create one
        scene_name = f"MathVisualization{uuid.uuid4().hex[:8]}"
        
        # Check if the code has imports for manim
        if "from manim import" not in manim_code and "import manim" not in manim_code:
            manim_code = "from manim import *\n" + manim_code
        
        # Extract the content that should go inside the construct method
        # This is a simplification - in reality, we'd need more sophisticated parsing
        # We'll assume any code not in a class or function should go in construct
        
        # First, let's create a basic scene class
        scene_class = f"""
class {scene_name}(Scene):
    def construct(self):
        # Generated scene content will go here
        pass
"""
        
        # Now let's try to extract the main code and place it in the construct method
        lines = manim_code.split('\n')
        imports = []
        other_classes = []
        main_code = []
        
        in_class_or_func = False
        class_or_func_indent = 0
        
        for line in lines:
            stripped = line.strip()
            
            # Skip empty lines
            if not stripped:
                continue
                
            # Collect imports
            if stripped.startswith(('import ', 'from ')):
                imports.append(line)
                continue
                
            # Detect start of class or function
            if stripped.startswith(('class ', 'def ')) and not in_class_or_func:
                in_class_or_func = True
                class_or_func_indent = len(line) - len(line.lstrip())
                other_classes.append(line)
                continue
                
            # If we're in a class or function, add to other_classes
            if in_class_or_func:
                # Check if we're still in the class/function by comparing indentation
                if not stripped.startswith(('class ', 'def ')) and (len(line) - len(line.lstrip()) <= class_or_func_indent):
                    in_class_or_func = False
                else:
                    other_classes.append(line)
                    continue
            
            # If not in class or function, it's main code
            if not in_class_or_func:
                main_code.append(line)
        
        # Now construct the new code with the scene class
        construct_code = "\n".join(f"        {line}" if line.strip() else line for line in main_code)
        
        new_scene_class = f"""
class {scene_name}(Scene):
    def construct(self):
{construct_code}
"""
        
        # Combine everything
        new_code = "\n".join(imports) + "\n\n" + "\n".join(other_classes) + "\n" + new_scene_class
        
        logger.info(f"Created new scene class: {scene_name}")
        return new_code, scene_name

    def render_manim(self, manim_code):
        """Render Manim code to a video file and return the file path."""
        try:
            # Ensure we have a proper scene class
            manim_code, scene_name = self.ensure_scene_class(manim_code)
            
            # Create a temporary directory for the Manim script
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_dir_path = Path(temp_dir)
                script_path = temp_dir_path / "manim_script.py"
                
                # Write the Manim code to a temporary file
                with open(script_path, 'w') as f:
                    f.write(manim_code)
                
                # Generate a unique output filename
                output_filename = f"manim_{uuid.uuid4().hex}.mp4"
                output_path = self.media_dir / output_filename
                
                # Try to fix the Cairo issue by setting the correct environment variables
                # This is a common issue on macOS
                env = os.environ.copy()
                
                # Add potential paths for Cairo libraries
                library_paths = [
                    "/usr/local/lib",
                    "/opt/homebrew/lib",
                    "/usr/lib",
                    os.path.expanduser("~/miniconda3/lib")
                ]
                
                # Set library path environment variables
                if "DYLD_LIBRARY_PATH" in env:
                    env["DYLD_LIBRARY_PATH"] = ":".join([env["DYLD_LIBRARY_PATH"]] + library_paths)
                else:
                    env["DYLD_LIBRARY_PATH"] = ":".join(library_paths)
                    
                if "DYLD_FALLBACK_LIBRARY_PATH" in env:
                    env["DYLD_FALLBACK_LIBRARY_PATH"] = ":".join([env["DYLD_FALLBACK_LIBRARY_PATH"]] + library_paths)
                else:
                    env["DYLD_FALLBACK_LIBRARY_PATH"] = ":".join(library_paths)
                
                # Build the Manim command
                cmd = [
                    "python", "-m", "manim",
                    str(script_path),
                    scene_name,
                    "-qm",  # Medium quality
                    "--media_dir", str(temp_dir_path),
                    "--output_file", output_filename
                ]
                
                logger.info(f"Running Manim command: {' '.join(cmd)}")
                logger.info(f"With environment variables: DYLD_LIBRARY_PATH={env.get('DYLD_LIBRARY_PATH')}")
                
                # Run Manim to generate the video
                process = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    check=False,  # Don't raise an exception on non-zero exit
                    env=env  # Use our modified environment
                )
                
                # Log the output
                logger.info(f"Manim stdout: {process.stdout}")
                if process.stderr:
                    logger.error(f"Manim stderr: {process.stderr}")
                
                # Check if the process was successful
                if process.returncode != 0:
                    logger.error(f"Manim rendering failed with code {process.returncode}")
                    raise Exception(f"Manim rendering failed: {process.stderr}")
                
                # Find the generated video file
                video_path = None
                for root, _, files in os.walk(temp_dir_path):
                    for file in files:
                        if file.endswith('.mp4'):
                            video_path = Path(root) / file
                            break
                    if video_path:
                        break
                
                if not video_path:
                    logger.error("No video file was generated by Manim")
                    raise Exception("No video file was generated by Manim")
                
                # Copy the video to our media directory
                shutil.copy(video_path, output_path)
                logger.info(f"Video generated successfully at {output_path}")
                
                return str(output_path)
        
        except Exception as e:
            logger.exception("Error rendering Manim animation")
            raise e

    def get_video_base64(self, video_path):
        """Convert a video file to a base64 string."""
        try:
            with open(video_path, 'rb') as f:
                video_data = f.read()
            
            base64_data = base64.b64encode(video_data).decode('utf-8')
            logger.info(f"Converted video to base64 (length: {len(base64_data)})")
            return base64_data
        
        except Exception as e:
            logger.exception("Error converting video to base64")
            raise e

    def render_and_encode(self, manim_code):
        """Render Manim code to a video and return as base64."""
        video_path = self.render_manim(manim_code)
        base64_data = self.get_video_base64(video_path)
        return {
            'video_path': video_path,
            'video_base64': base64_data
        }
