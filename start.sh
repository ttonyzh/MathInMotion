#!/bin/bash

# Set up colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Setting up Tutor AI Application ===${NC}"

# Run the Python backend setup script
echo -e "${BLUE}Setting up Python backend...${NC}"
cd python_backend
chmod +x setup.sh
./setup.sh
cd ..

# Function to handle cleanup on exit
cleanup() {
  echo -e "\n${BLUE}Shutting down servers...${NC}"
  kill $NEXT_PID $FLASK_PID 2>/dev/null
  exit 0
}

# Set trap for cleanup on script termination
trap cleanup SIGINT SIGTERM

# Start the Flask server in the background
echo -e "${BLUE}Starting Python backend for visualizations...${NC}"
cd python_backend
source venv/bin/activate
python app.py > ../python_backend.log 2>&1 &
FLASK_PID=$!
cd ..

# Check if Flask server started successfully
sleep 2
if ps -p $FLASK_PID > /dev/null; then
  echo -e "${GREEN}Python backend started successfully on http://localhost:5001${NC}"
else
  echo -e "${RED}Failed to start Python backend. Check python_backend.log for details.${NC}"
  exit 1
fi

# Start the Next.js server in the background
echo -e "${BLUE}Starting Next.js application...${NC}"
npm run dev > nextjs.log 2>&1 &
NEXT_PID=$!

# Check if Next.js server started successfully
sleep 5
if ps -p $NEXT_PID > /dev/null; then
  echo -e "${GREEN}Next.js application started successfully!${NC}"
  echo -e "${GREEN}Your Tutor AI application is now running.${NC}"
  echo -e "${GREEN}Access it at: http://localhost:3000${NC}"
  echo -e "${BLUE}(Press Ctrl+C to stop both servers)${NC}"
else
  echo -e "${RED}Failed to start Next.js application. Check nextjs.log for details.${NC}"
  kill $FLASK_PID
  exit 1
fi

# Keep the script running to maintain the background processes
wait
