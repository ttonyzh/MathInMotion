#!/bin/bash

# Create a backup of the current state
echo "Creating backup of the current state..."
BACKUP_DIR="Tutor_AI_cleanup_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup files that will be removed
mkdir -p "$BACKUP_DIR/python_backend"
mv tutor_ai/python_backend/app.py "$BACKUP_DIR/python_backend/" 2>/dev/null || true
mv tutor_ai/python_backend/setup.sh "$BACKUP_DIR/python_backend/" 2>/dev/null || true
mv tutor_ai/start.sh "$BACKUP_DIR/" 2>/dev/null || true
mv cleanup.sh "$BACKUP_DIR/" 2>/dev/null || true
mv cleanup_log.txt "$BACKUP_DIR/" 2>/dev/null || true
mv MacTeX.pkg "$BACKUP_DIR/" 2>/dev/null || true

# Remove the files
echo "Removing unnecessary files..."
rm -f tutor_ai/python_backend/docker_manim_renderer.log
rm -f cleanup.sh cleanup_log.txt
rm -f MacTeX.pkg
rm -f tutor_ai/start.sh
rm -f tutor_ai/python_backend/app.py
rm -f tutor_ai/python_backend/setup.sh

# Remove the virtual environment if it exists
if [ -d "venv" ]; then
    echo "Removing virtual environment..."
    rm -rf venv
fi

# Clean up empty directories
echo "Cleaning up empty directories..."
find . -type d -empty -delete

echo "Cleanup complete. A backup has been created in: $BACKUP_DIR"
echo "You can review the backup and delete it if everything looks good."
echo "To restore any file, copy it back from the backup directory."
