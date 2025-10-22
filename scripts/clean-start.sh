#!/bin/bash

# Clean start script - kills existing processes and starts fresh

echo "Cleaning up existing processes..."

# Kill any existing butter-visualizer processes
pkill -f "vite.*5173" 2>/dev/null
pkill -f "vite.*5175" 2>/dev/null
pkill -f "electron.*butter-visualizer" 2>/dev/null

# Wait a moment
sleep 1

# Run the regular dev script
bash scripts/dev.sh
