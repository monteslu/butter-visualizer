#!/bin/bash

# Setup script for development - copies assets to public folders

echo "Setting up development environment..."

# Create public directories
mkdir -p src/renderer/public/fonts
mkdir -p src/renderer/public/butterchurn-screenshots
mkdir -p src/popup/public

# Copy butterchurn libraries to both (they're referenced in HTML)
echo "Copying butterchurn libraries..."
cp src/lib/butterchurn.min.js src/renderer/public/
cp src/lib/butterchurnPresets.min.js src/renderer/public/
cp src/lib/butterchurn.min.js src/popup/public/
cp src/lib/butterchurnPresets.min.js src/popup/public/

# Copy Material Icons font (only to renderer, served at /fonts for all)
echo "Copying Material Icons font..."
cp static/fonts/material-icons.woff2 src/renderer/public/fonts/

# Copy preset thumbnails (only to renderer, served at /butterchurn-screenshots for all)
echo "Copying preset thumbnails..."
cp -r static/images/butterchurn-screenshots/* src/renderer/public/butterchurn-screenshots/

echo "✅ Development environment ready!"
