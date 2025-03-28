#!/bin/bash

# This script fixes hardcoded WebSocket URLs in the application
# Run this script on your server

echo "Fixing WebSocket URLs in JavaScript files..."

# Create a backup directory
mkdir -p /opt/speedtest/backups

# Find and replace hardcoded WebSocket URLs
find /opt/speedtest/dist -type f -name "*.js" -exec grep -l "wss://localhost/v2" {} \; | while read file; do
  echo "Found hardcoded WebSocket URL in: $file"
  
  # Create backup
  cp "$file" "/opt/speedtest/backups/$(basename "$file").bak"
  
  # Replace the hardcoded URL with the dynamic one
  # This replaces "wss://localhost/v2" with the correct path
  sed -i 's|wss://localhost/v2|wss://\' + window.location.host + \'/api/ws-packet-test|g' "$file"
  
  echo "Fixed: $file"
done

# Search for any other hardcoded WebSocket URLs and report them
echo ""
echo "Checking for other potential WebSocket issues..."
find /opt/speedtest/dist -type f -name "*.js" -exec grep -l "wss://localhost" {} \;

echo ""
echo "Script completed. Restart your application with: pm2 restart speedtest"