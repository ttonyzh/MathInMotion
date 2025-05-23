#!/bin/bash

# Set up colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Setting up Python backend environment...${NC}"

# Remove existing virtual environment if it exists
if [ -d "venv" ]; then
    echo -e "${BLUE}Removing existing virtual environment...${NC}"
    rm -rf venv
fi

# Create a new virtual environment
echo -e "${BLUE}Creating new virtual environment...${NC}"
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate

# Upgrade pip
echo -e "${BLUE}Upgrading pip...${NC}"
pip install --upgrade pip

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
pip install -r requirements.txt

echo -e "${GREEN}Setup complete! You can now run the Python backend with:${NC}"
echo -e "${GREEN}source venv/bin/activate && python app.py${NC}"
