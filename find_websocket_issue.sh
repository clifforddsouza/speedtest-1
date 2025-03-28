#!/bin/bash

# This script diagnoses WebSocket connection issues by checking server connectivity
# and testing WebSocket endpoints

echo "=== WebSocket Connection Diagnostics Tool ==="
echo "This script will diagnose WebSocket connection issues in your SpeedTest application."
echo ""

# Get the server's IP address and domain
SERVER_IP=$(hostname -I | awk '{print $1}')
SERVER_DOMAIN=$(hostname -f 2>/dev/null || echo "unknown")

echo "Server Information:"
echo "- IP Address: $SERVER_IP"
echo "- Hostname: $SERVER_DOMAIN"
echo ""

# Check if required tools are installed
echo "Checking for required tools..."
for tool in curl nc lsof ss grep; do
  if ! command -v $tool &> /dev/null; then
    echo "⚠️ $tool is not installed. Some tests may not work."
  else
    echo "✅ $tool is available"
  fi
done
echo ""

# Check if the application is running
echo "Checking if the application is running..."
if pm2 list | grep -q speedtest; then
  echo "✅ Speedtest application is running in PM2"
  APP_PORT=$(pm2 describe speedtest | grep -oP 'port.*?\K\d+' || echo "3000")
  echo "  - Application is likely running on port $APP_PORT"
else
  echo "⚠️ Speedtest application is not running in PM2"
  echo "  - Run 'pm2 start speedtest' to start the application"
fi
echo ""

# Check if the port is open
echo "Checking port status..."
PORT_TO_CHECK=3000
if ss -tuln | grep -q ":$PORT_TO_CHECK\\b"; then
  echo "✅ Port $PORT_TO_CHECK is open and listening"
else
  echo "⚠️ Port $PORT_TO_CHECK is not open. The application may not be running correctly."
fi
echo ""

# Check Nginx configuration
echo "Checking Nginx configuration..."
if command -v nginx &> /dev/null; then
  if nginx -t &> /dev/null; then
    echo "✅ Nginx configuration is valid"
    
    # Check for WebSocket configuration
    if grep -r "upgrade" /etc/nginx/sites-enabled/ &> /dev/null; then
      echo "✅ WebSocket upgrade directives found in Nginx configuration"
    else
      echo "⚠️ No WebSocket upgrade directives found in Nginx configuration"
      echo "  - Add the following to your Nginx server block:"
      echo "    location /api/ws-packet-test {"
      echo "      proxy_pass http://localhost:3000;"
      echo "      proxy_http_version 1.1;"
      echo "      proxy_set_header Upgrade \$http_upgrade;"
      echo "      proxy_set_header Connection \"upgrade\";"
      echo "      proxy_set_header Host \$host;"
      echo "    }"
    fi
  else
    echo "⚠️ Nginx configuration has errors"
    nginx -t
  fi
else
  echo "ℹ️ Nginx is not installed or not in the PATH"
fi
echo ""

# Test HTTP connection to the API
echo "Testing HTTP connection to the API..."
HTTP_URL="http://localhost:3000/api/user"
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$HTTP_URL")
if [ "$HTTP_RESPONSE" = "401" ]; then
  echo "✅ API connection working (got 401 Unauthorized which is expected when not logged in)"
else
  echo "⚠️ API connection issue (got $HTTP_RESPONSE instead of expected 401)"
  echo "  - Try: curl -v $HTTP_URL"
fi
echo ""

# Test WebSocket connection directly (basic check)
echo "Testing direct WebSocket connection (this may take a few seconds)..."
WS_TEST=$(timeout 5 bash -c "echo -e 'GET /api/ws-packet-test HTTP/1.1\r\nHost: localhost:3000\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n' | nc localhost 3000" 2>&1)

if echo "$WS_TEST" | grep -q "101 Switching Protocols"; then
  echo "✅ Direct WebSocket connection successful!"
else
  echo "⚠️ Direct WebSocket connection failed"
  echo "  - Response from server:"
  echo "$WS_TEST" | head -10
fi
echo ""

# Check database connection
echo "Testing database connection..."
if [ -f "/opt/speedtest/test_db_connection.js" ]; then
  echo "Running database connection test script..."
  node /opt/speedtest/test_db_connection.js
else
  echo "ℹ️ Database test script not found"
  echo "  - Run the database fix script first to create the test script"
fi
echo ""

# Provide recommendations
echo "=== Recommendations ==="
echo "Based on the diagnostics, here are the recommended steps:"
echo ""
echo "1. Make sure your Nginx configuration properly forwards WebSocket connections:"
echo "   - Check /etc/nginx/sites-enabled/ for your site configuration"
echo "   - Add or verify WebSocket proxy settings for /api/ws-packet-test"
echo ""
echo "2. Run both fix scripts:"
echo "   - ./neon_db_fix.sh (fixes database connection)"
echo "   - ./fix_websocket_urls.sh (fixes client-side WebSocket URLs)"
echo ""
echo "3. Restart the application:"
echo "   - pm2 restart speedtest"
echo ""
echo "4. Check logs for errors:"
echo "   - pm2 logs speedtest"
echo ""
echo "If you continue to have issues, please provide the output of this script."