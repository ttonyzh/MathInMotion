import os
import sys
import subprocess
import logging
import uuid
import re
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('docker_manim_renderer')

class DockerManimRenderer:
    def __init__(self, host_media_dir):
        self.host_media_dir = Path(host_media_dir).resolve()
        self.host_media_dir.mkdir(parents=True, exist_ok=True)

        (self.host_media_dir / 'temp').mkdir(exist_ok=True)
        (self.host_media_dir / 'videos').mkdir(exist_ok=True)

        logger.info(f"Initialized ManimRenderer with media directory: {self.host_media_dir}")

    def detect_scene_class(self, manim_code):
        """Detect the scene class name from the Manim code."""
        scene_pattern = r'class\s+(\w+)\s*\(\s*Scene\s*\)'
        match = re.search(scene_pattern, manim_code)
        return match.group(1) if match else None

    def render_manim_code(self, manim_code):
        """
        Render Manim code using local Manim installation.

        Args:
            manim_code: String containing the Manim code to render

        Returns:
            dict: Dictionary containing 'success' status and either 'video_path' or 'error'
        """
        manim_code = manim_code.replace('Highlight', 'SurroundingRectangle')
        manim_code = manim_code.replace('highlight', 'surround')

        pattern = r'self\.play\s*\(\s*SurroundingRectangle\('
        replacement = 'rect = SurroundingRectangle(\n            self.play(Create(rect))\n            rect = '
        manim_code = re.sub(pattern, replacement, manim_code)

        print("\n" + "="*80)
        print("GENERATED MANIM CODE:")
        print("="*80)
        print(manim_code)
        print("="*80 + "\n")

        try:
            render_id = str(uuid.uuid4())
            script_filename = f"render_{render_id}.py"

            temp_dir = self.host_media_dir / "temp"
            temp_dir.mkdir(exist_ok=True)
            script_path = temp_dir / script_filename

            with open(script_path, 'w', encoding='utf-8') as f:
                f.write(manim_code)

            scene_class = self.detect_scene_class(manim_code)
            if not scene_class:
                raise ValueError("No valid Scene class found in the provided Manim code")

            output_dir = self.host_media_dir / "videos"
            output_dir.mkdir(exist_ok=True)

            # Use the same Python executable that's running this script
            manim_cmd = [
                sys.executable, '-m', 'manim',
                str(script_path),
                scene_class,
                '-qm',                    # Medium quality (480p)
                '--media_dir', str(output_dir),
                '--progress_bar', 'none',
                '--format', 'mp4',
                '--disable_caching'
            ]

            logger.info(f"Running Manim command: {' '.join(manim_cmd)}")

            result = subprocess.run(
                manim_cmd,
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.stdout:
                logger.info(f"Manim output:\n{result.stdout}")
            if result.stderr:
                logger.info(f"Manim stderr:\n{result.stderr}")

            if result.returncode != 0:
                return {
                    'success': False,
                    'error': f"Manim rendering failed: {result.stderr}"
                }

            # Search for the output mp4 file
            mp4_files = list(output_dir.rglob('*.mp4'))
            if not mp4_files:
                return {
                    'success': False,
                    'error': "Rendering completed but no MP4 file was found"
                }

            # Pick the most recently modified mp4
            output_path = max(mp4_files, key=lambda p: p.stat().st_mtime)

            # Clean up temp script
            try:
                script_path.unlink()
            except Exception as e:
                logger.warning(f"Failed to clean up script file: {e}")

            return {
                'success': True,
                'video_path': str(output_path)
            }

        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'error': "Rendering timed out after 120 seconds"
            }
        except Exception as e:
            logger.exception("Error in render_manim_code")
            return {
                'success': False,
                'error': str(e)
            }
