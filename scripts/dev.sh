#!/bin/bash

# Build and run Electron in dev mode

echo "Starting Butter Visualizer in development mode..."

# Build everything
echo "Building renderer and popup..."
npm run build:all

if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

echo "✅ Build complete"

# Start Electron in dev mode (with Express server serving built files)
echo "Starting Electron..."
NODE_ENV=production electron . --dev --no-sandbox
