#!/bin/bash

# This script will help find WebSocket issues in the codebase

echo "Searching for WebSocket connection code..."

# Find files containing WebSocket references
echo "=== Files with WebSocket references ==="
find /opt/speedtest -type f -name "*.js" -exec grep -l "WebSocket" {} \;

# Look for hardcoded WebSocket URLs
echo ""
echo "=== Hardcoded WebSocket URLs ==="
find /opt/speedtest -type f -name "*.js" -exec grep -l "wss://" {} \;
find /opt/speedtest -type f -name "*.js" -exec grep -l "ws://" {} \;

# Check for localhost references
echo ""
echo "=== localhost references ==="
find /opt/speedtest -type f -name "*.js" -exec grep -l "localhost" {} \;

# Check for v2 endpoint references
echo ""
echo "=== /v2 endpoint references ==="
find /opt/speedtest -type f -name "*.js" -exec grep -l "/v2" {} \;

# Display contents of suspicious files
echo ""
echo "=== Contents of files with WebSocket connections ==="
WEBSOCKET_FILES=$(find /opt/speedtest -type f -name "*.js" -exec grep -l "new WebSocket" {} \;)
for file in $WEBSOCKET_FILES; do
  echo ""
  echo "=== File: $file ==="
  grep -A 2 -B 2 "new WebSocket" "$file"
done

echo ""
echo "Script completed. Look for hardcoded WebSocket URLs or localhost references."