#!/bin/bash

# This script fixes WebSocket connection issues in the SpeedTest client
# It focuses on ensuring WebSocket URLs are constructed correctly for the environment

echo "=== Fixing WebSocket Connection URLs ==="

# Set working directory
APP_DIR="/opt/speedtest"
cd "$APP_DIR" || { echo "Error: Could not cd to $APP_DIR"; exit 1; }

# Create backup directory
BACKUP_DIR="./backups/websocket_fix_$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Step 1: Find the client-side WebSocket code
echo "Looking for WebSocket connection files..."
WS_FILES=()

# Common locations to check
find_targets=(
  "./client/src/lib/speedtest.ts"
  "./client/src/components/SpeedTestPanel.tsx"
  "./client/src/lib/packetTest.ts"
  "./client/src/lib/websocket.ts"
  "./client/src/utils/websocket.ts"
)

# Search for files first in common locations
for target in "${find_targets[@]}"; do
  if [ -f "$target" ]; then
    echo "Found potential WebSocket file: $target"
    WS_FILES+=("$target")
  fi
done

# If none found in common locations, search for WebSocket usages
if [ ${#WS_FILES[@]} -eq 0 ]; then
  echo "Searching for files with WebSocket usage..."
  FOUND_FILES=$(grep -r --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" "new WebSocket" . | cut -d: -f1 | sort -u)
  
  if [ -n "$FOUND_FILES" ]; then
    while IFS= read -r file; do
      echo "Found WebSocket usage in: $file"
      WS_FILES+=("$file")
    done <<< "$FOUND_FILES"
  fi
  
  # Also check for websocket imports
  IMPORT_FILES=$(grep -r --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" "import.*WebSocket" . | cut -d: -f1 | sort -u)
  
  if [ -n "$IMPORT_FILES" ]; then
    while IFS= read -r file; do
      if ! [[ " ${WS_FILES[@]} " =~ " ${file} " ]]; then
        echo "Found WebSocket import in: $file"
        WS_FILES+=("$file")
      fi
    done <<< "$IMPORT_FILES"
  fi
fi

if [ ${#WS_FILES[@]} -eq 0 ]; then
  echo "! Could not find any files with WebSocket usage"
  echo "Trying broader search patterns..."
  
  # Final attempt with broader patterns
  LAST_ATTEMPT=$(grep -r --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" -E "websocket|ws:|wss:" . | cut -d: -f1 | sort -u)
  
  if [ -n "$LAST_ATTEMPT" ]; then
    while IFS= read -r file; do
      echo "Found potential WebSocket reference in: $file"
      WS_FILES+=("$file")
    done <<< "$LAST_ATTEMPT"
  fi
fi

if [ ${#WS_FILES[@]} -eq 0 ]; then
  echo "! Could not find any WebSocket-related files"
  exit 1
fi

# Step 2: Fix the WebSocket URLs in each file
echo ""
echo "Fixing WebSocket URLs in found files..."

for file in "${WS_FILES[@]}"; do
  echo "Processing $file..."
  
  # Create backup
  cp "$file" "$BACKUP_DIR/$(basename "$file").bak"
  
  # Check file content
  if grep -q "new WebSocket" "$file"; then
    echo "Found WebSocket constructor in $file"
    
    # Create temporary file
    TEMP_FILE=$(mktemp)
    
    # Different patterns to fix:
    # 1. Hardcoded localhost
    # 2. Incorrect protocol detection
    # 3. Incorrect path construction
    cat "$file" | sed '
      # Fix hardcoded localhost WebSocket URLs
      s|new WebSocket("ws://localhost:[0-9]\+|new WebSocket(wsUrl|g
      s|new WebSocket("wss://localhost:[0-9]\+|new WebSocket(wsUrl|g
      s|new WebSocket(`ws://localhost:[0-9]\+|new WebSocket(wsUrl|g
      s|new WebSocket(`wss://localhost:[0-9]\+|new WebSocket(wsUrl|g
      
      # Fix direct window.location.hostname usage without protocol
      s|new WebSocket("ws://" + window.location.hostname|new WebSocket(wsUrl|g
      s|new WebSocket("wss://" + window.location.hostname|new WebSocket(wsUrl|g
      s|new WebSocket(`ws://${window.location.hostname}|new WebSocket(wsUrl|g
      s|new WebSocket(`wss://${window.location.hostname}|new WebSocket(wsUrl|g
      
      # Fix protocol detection
      s|const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";|const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";|g
      s|const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";|const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";|g
      
      # Fix wrong path
      s|/ws-speedtest|/api/ws-packet-test|g
      s|/ws-packet-test|/api/ws-packet-test|g
      s|/ws-ping|/api/ws-packet-test|g
      s|/ws|/api/ws-packet-test|g
    ' > "$TEMP_FILE"
    
    # Check if we need to add wsUrl construction if it doesn't exist
    if ! grep -q "const \(wsUrl\|websocketUrl\) = " "$TEMP_FILE" && grep -q "new WebSocket(wsUrl" "$TEMP_FILE"; then
      # Need to add wsUrl construction
      echo "Adding WebSocket URL construction..."
      
      # Find the appropriate place to add the code - before first WebSocket usage
      WS_LINE=$(grep -n "new WebSocket" "$TEMP_FILE" | head -1 | cut -d: -f1)
      if [ -n "$WS_LINE" ]; then
        # Create another temp file
        TEMP_FILE2=$(mktemp)
        
        # Add wsUrl construction before WebSocket usage
        head -n $((WS_LINE - 1)) "$TEMP_FILE" > "$TEMP_FILE2"
        cat >> "$TEMP_FILE2" << 'EOF'
  // Construct WebSocket URL with correct protocol and host
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/api/ws-packet-test`;
EOF
        tail -n +$WS_LINE "$TEMP_FILE" >> "$TEMP_FILE2"
        mv "$TEMP_FILE2" "$TEMP_FILE"
      fi
    elif grep -q "new WebSocket(" "$TEMP_FILE" && ! grep -q "new WebSocket(wsUrl" "$TEMP_FILE" && ! grep -q "const \(wsUrl\|websocketUrl\) = " "$TEMP_FILE"; then
      # WebSocket constructor exists but doesn't use wsUrl and no wsUrl defined
      echo "Updating WebSocket constructor to use dynamic URL..."
      
      # Create another temp file
      TEMP_FILE2=$(mktemp)
      
      # First add wsUrl construction before first WebSocket usage
      WS_LINE=$(grep -n "new WebSocket" "$TEMP_FILE" | head -1 | cut -d: -f1)
      head -n $((WS_LINE - 1)) "$TEMP_FILE" > "$TEMP_FILE2"
      cat >> "$TEMP_FILE2" << 'EOF'
  // Construct WebSocket URL with correct protocol and host
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/api/ws-packet-test`;
EOF
      
      # Then update the WebSocket constructor
      cat "$TEMP_FILE" | tail -n +$WS_LINE | sed '
        s|new WebSocket("[^"]*")|new WebSocket(wsUrl)|g
        s|new WebSocket(`[^`]*`)|new WebSocket(wsUrl)|g
      ' >> "$TEMP_FILE2"
      
      mv "$TEMP_FILE2" "$TEMP_FILE"
    fi
    
    # Replace original file
    mv "$TEMP_FILE" "$file"
    echo "✓ Updated WebSocket URL in $file"
  elif grep -q "websocket.*url" "$file" || grep -q "wsUrl" "$file"; then
    echo "Found WebSocket URL variables in $file"
    
    # Create temporary file
    TEMP_FILE=$(mktemp)
    
    # Fix URL construction
    cat "$file" | sed '
      # Fix protocol detection
      s|const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";|const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";|g
      s|const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";|const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";|g
      
      # Fix wrong path
      s|/ws-speedtest|/api/ws-packet-test|g
      s|/ws-packet-test|/api/ws-packet-test|g
      s|/ws-ping|/api/ws-packet-test|g
      s|/ws|/api/ws-packet-test|g
      
      # Fix URL construction
      s|`${protocol}//${window.location.hostname}:[0-9]\+/|`${protocol}//${window.location.host}/|g
      s|`${wsProtocol}//${window.location.hostname}:[0-9]\+/|`${wsProtocol}//${window.location.host}/|g
      s|"${protocol}//" + window.location.hostname + ":[0-9]\+/|"${protocol}//" + window.location.host + "/|g
      s|"${wsProtocol}//" + window.location.hostname + ":[0-9]\+/|"${wsProtocol}//" + window.location.host + "/|g
    ' > "$TEMP_FILE"
    
    # Replace original file
    mv "$TEMP_FILE" "$file"
    echo "✓ Updated WebSocket URL construction in $file"
  else
    echo "! No direct WebSocket URL usage found in $file"
  fi
done

# Step 3: Check and fix server-side WebSocket code
echo ""
echo "Checking server-side WebSocket implementation..."

SERVER_WS_FILES=(
  "./server/routes.ts"
  "./server/index.ts"
  "./server/app.ts"
  "./server/websocket.ts"
)

for file in "${SERVER_WS_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Checking $file for WebSocket server implementation..."
    
    # Check if file contains WebSocket server setup
    if grep -q "WebSocketServer" "$file" || grep -q "new Server" "$file"; then
      echo "Found WebSocket server in $file"
      
      # Create backup
      cp "$file" "$BACKUP_DIR/$(basename "$file").bak"
      
      # Check if path is correctly set
      if ! grep -q "path: '/api/ws-packet-test'" "$file"; then
        # Need to fix the path
        echo "Updating WebSocket server path..."
        
        # Create temporary file
        TEMP_FILE=$(mktemp)
        
        # Update WebSocket server path
        cat "$file" | sed '
          # Fix WebSocketServer with no path or different path
          s|new WebSocketServer({ server: \([^}]*\)})|new WebSocketServer({ server: \1, path: "/api/ws-packet-test" })|g
          s|new WebSocketServer({ server: \([^,]*\), path: "[^"]*" })|new WebSocketServer({ server: \1, path: "/api/ws-packet-test" })|g
          s|new Server({ server: \([^}]*\)})|new Server({ server: \1, path: "/api/ws-packet-test" })|g
          s|new Server({ server: \([^,]*\), path: "[^"]*" })|new Server({ server: \1, path: "/api/ws-packet-test" })|g
        ' > "$TEMP_FILE"
        
        # Replace original file
        mv "$TEMP_FILE" "$file"
        echo "✓ Updated WebSocket server path in $file"
      else
        echo "✓ WebSocket server path already correct in $file"
      fi
    fi
  fi
done

# Step 4: Restart the application
echo ""
echo "Restarting the application to apply changes..."
if command -v pm2 &> /dev/null && pm2 list | grep -q speedtest; then
  pm2 restart speedtest
  echo "✓ Restarted application with PM2"
else
  echo "! Could not restart application with PM2"
  echo "  Please restart the application manually"
fi

echo ""
echo "=== WebSocket Fix Complete ==="
echo ""
echo "Changes made:"
echo "1. Fixed WebSocket URL construction in client-side code"
echo "2. Updated WebSocket server path to /api/ws-packet-test if needed"
echo "3. Restarted the application"
echo ""
echo "The WebSocket connections should now be correctly established using the server's"
echo "actual hostname and proper protocol detection."
echo ""
echo "If you still experience issues:"
echo "1. Check browser console for WebSocket connection errors"
echo "2. Check application logs: pm2 logs speedtest"
echo "3. You can restore from backups in: $BACKUP_DIR"