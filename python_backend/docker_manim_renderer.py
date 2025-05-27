import os
import subprocess
import logging
import uuid
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('docker_manim_renderer')

class DockerManimRenderer:
    def __init__(self, host_media_dir):
        """
        Initialize the Docker-based Manim renderer.
        
        Args:
            host_media_dir: Path to the directory on the host where media will be saved
        """
        self.host_media_dir = Path(host_media_dir).resolve()  # Use absolute path
        self.host_media_dir.mkdir(parents=True, exist_ok=True)
        
        # Create necessary subdirectories
        (self.host_media_dir / 'temp').mkdir(exist_ok=True)
        (self.host_media_dir / 'videos').mkdir(exist_ok=True)
        
        logger.info(f"Initialized DockerManimRenderer with host media directory: {self.host_media_dir}")
        logger.info(f"Directory contents: {list(self.host_media_dir.glob('*'))}")
    
    def detect_scene_class(self, manim_code):
        """Detect the scene class name from the Manim code."""
        import re
        scene_pattern = r'class\s+(\w+)\s*\(\s*Scene\s*\)'
        match = re.search(scene_pattern, manim_code)
        return match.group(1) if match else None
    
    def render_manim_code(self, manim_code):
        """
        Render Manim code using Docker.
        
        Args:
            manim_code: String containing the Manim code to render
            
        Returns:
            dict: Dictionary containing 'success' status and either 'video_path' or 'error'
        """
        # Replace any instances of Highlight with SurroundingRectangle
        manim_code = manim_code.replace('Highlight', 'SurroundingRectangle')
        manim_code = manim_code.replace('highlight', 'surround')
        
        # Print the Manim code for debugging
        print("\n" + "="*80)
        print("GENERATED MANIM CODE:")
        print("="*80)
        print(manim_code)
        print("="*80 + "\n")
        
        try:
            # Create a unique filename for this render
            render_id = str(uuid.uuid4())
            script_filename = f"render_{render_id}.py"
            output_filename = f"output_{render_id}.mp4"
            
            # Create the script file in a temporary directory
            temp_dir = self.host_media_dir / "temp"
            temp_dir.mkdir(exist_ok=True)
            script_path = temp_dir / script_filename
            
            # Save the Manim code to a file in your home directory
            home_dir = Path.home()
            debug_file = home_dir / 'manim_debug.py'
            with open(debug_file, 'w') as f:
                f.write(manim_code)
            print(f"\n\n=== MANIM CODE SAVED TO: {debug_file} ===\n")
            
            with open(script_path, 'w') as f:
                f.write(manim_code)
            
            # Log the Manim code to a file for debugging
            debug_log_path = self.host_media_dir / "debug_manim_code.py"
            with open(debug_log_path, 'w') as f:
                f.write("# Generated Manim code:\n" + manim_code)
            logger.info(f"Saved generated Manim code to {debug_log_path}")
            
            # Detect the scene class
            scene_class = self.detect_scene_class(manim_code)
            if not scene_class:
                raise ValueError("No valid Scene class found in the provided Manim code")
            
            # Create output directory if it doesn't exist
            output_dir = self.host_media_dir / "videos"
            output_dir.mkdir(exist_ok=True)
            
            # Prepare the Docker command with a specific image that includes ffmpeg
            docker_cmd = [
                'docker', 'run', '--rm',
                '-v', f"{script_path.parent}:/manim/script",
                '-v', f"{output_dir}:/manim/output",
                'manimcommunity/manim:latest',  # Use latest version that includes ffmpeg
                'manim', f"/manim/script/{script_filename}",
                scene_class, 
                '-qm',  # Medium quality, 480p30
                '--media_dir', '/manim/output',
                '--progress_bar', 'none',  # Disable progress bar to avoid log spam
                '--format', 'mp4',  # Explicitly set output format to mp4
                '--disable_caching'  # Disable caching to avoid potential issues
            ]
            
            logger.info(f"Running Docker command: {' '.join(docker_cmd)}")
            
            # Run the Docker command with a timeout (60 seconds)
            try:
                result = subprocess.run(
                    docker_cmd,
                    capture_output=True,
                    text=True,
                    timeout=60  # 60 second timeout
                )
                
                # Log the output
                if result.stdout:
                    logger.info(f"Docker command output:\n{result.stdout}")
                if result.stderr:
                    logger.error(f"Docker command error:\n{result.stderr}")
                
                # Check if the command was successful
                if result.returncode != 0:
                    return {
                        'success': False,
                        'error': f"Failed to render animation: {result.stderr}"
                    }
                
                # The rendered video should be in the output directory
                # Check the standard output location first
                output_path = output_dir / 'videos' / script_path.stem / '720p30' / f"{scene_class}.mp4"
                
                if not output_path.exists():
                    # Try alternative location (older Manim versions or different quality)
                    video_dir = output_dir / 'videos' / script_path.stem
                    if video_dir.exists():
                        # Find the first mp4 file in any subdirectory
                        mp4_files = list(video_dir.rglob('*.mp4'))
                        if mp4_files:
                            output_path = mp4_files[0]
                        else:
                            return {
                                'success': False,
                                'error': f"No MP4 files found in {video_dir}"
                            }
                    else:
                        return {
                            'success': False,
                            'error': f"Video directory not found: {video_dir}"
                        }
                
                # Move the file to the final location with a better name
                final_path = output_dir / f"animation_{render_id}.mp4"
                output_path.rename(final_path)
                
                # Clean up temporary files
                try:
                    script_path.unlink()
                except Exception as e:
                    logger.warning(f"Failed to clean up script file: {e}")
                
                return {
                    'success': True,
                    'video_path': str(final_path)
                }
                
            except subprocess.TimeoutExpired:
                return {
                    'success': False,
                    'error': "Rendering timed out after 60 seconds"
                }
            
        except Exception as e:
            logger.exception("Error in render_manim_code")
            return {
                'success': False,
                'error': str(e)
            }
