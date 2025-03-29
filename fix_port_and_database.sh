#!/bin/bash

# This script fixes two critical issues:
# 1. Port mismatch between Nginx (expecting port 3000) and the application (running on port 5000)
# 2. Database connection issues with WebSockets

echo "=== SpeedTest Comprehensive Fix ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root (with sudo)"
  exit 1
fi

# Create backup directory
BACKUP_DIR="/opt/speedtest/backups/fix_$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Step 1: Fix Nginx configuration to use port 5000 instead of 3000
echo "Updating Nginx configuration to use port 5000..."

# Find Nginx configuration files
NGINX_CONFIGS=()
for dir in "/etc/nginx/sites-available" "/etc/nginx/conf.d" "/etc/nginx"; do
  if [ -d "$dir" ]; then
    for file in "$dir"/*; do
      if [ -f "$file" ] && grep -q "server {" "$file"; then
        NGINX_CONFIGS+=("$file")
      fi
    done
  fi
done

# If no configs found, create a default one
if [ ${#NGINX_CONFIGS[@]} -eq 0 ]; then
  echo "No Nginx server configurations found, creating a default one"
  NGINX_CONFIG="/etc/nginx/sites-available/default"
  NGINX_CONFIGS+=("$NGINX_CONFIG")
  
  # Create a basic configuration
  cat > "$NGINX_CONFIG" << 'EOF'
server {
    listen 80;
    server_name 192.168.8.92;
    
    access_log /var/log/nginx/speedtest.access.log;
    error_log /var/log/nginx/speedtest.error.log;
}
EOF
fi

# Update each configuration file
NGINX_CHANGED=0
for config in "${NGINX_CONFIGS[@]}"; do
  # Create backup
  cp "$config" "$BACKUP_DIR/$(basename "$config").bak"
  
  # Update all proxy_pass directives, changing port 3000 to 5000
  if grep -q "proxy_pass http://localhost:3000" "$config" || grep -q "proxy_pass http://127.0.0.1:3000" "$config"; then
    sed -i 's|proxy_pass http://localhost:3000|proxy_pass http://localhost:5000|g' "$config"
    sed -i 's|proxy_pass http://127.0.0.1:3000|proxy_pass http://127.0.0.1:5000|g' "$config"
    NGINX_CHANGED=1
    echo "✓ Updated proxy_pass in $config to use port 5000"
  else
    # Check if this config has a server block but no API locations
    if grep -q "server {" "$config" && ! grep -q "location /api/" "$config"; then
      # Add API and WebSocket location blocks to the first server block
      TEMP_FILE=$(mktemp)
      awk '
        /server {/,/}/ {
          print;
          if (!location_added && /server_name/) {
            print "\n    # API endpoints";
            print "    location /api/ {";
            print "        proxy_pass http://localhost:5000;";
            print "        proxy_http_version 1.1;";
            print "        proxy_set_header Host $host;";
            print "        proxy_set_header X-Real-IP $remote_addr;";
            print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;";
            print "        proxy_set_header X-Forwarded-Proto $scheme;";
            print "        proxy_read_timeout 90;";
            print "    }";
            print "\n    # WebSocket endpoint for packet loss testing";
            print "    location /api/ws-packet-test {";
            print "        proxy_pass http://localhost:5000;";
            print "        proxy_http_version 1.1;";
            print "        proxy_set_header Upgrade $http_upgrade;";
            print "        proxy_set_header Connection \"upgrade\";";
            print "        proxy_set_header Host $host;";
            print "        proxy_set_header X-Real-IP $remote_addr;";
            print "        proxy_read_timeout 86400;";
            print "    }";
            print "\n    # Frontend";
            print "    location / {";
            print "        proxy_pass http://localhost:5000;";
            print "        proxy_http_version 1.1;";
            print "        proxy_set_header Host $host;";
            print "        proxy_set_header X-Real-IP $remote_addr;";
            print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;";
            print "        proxy_set_header X-Forwarded-Proto $scheme;";
            print "        proxy_read_timeout 90;";
            print "    }";
            location_added = 1;
          }
          next;
        }
        { print; }
      ' "$config" > "$TEMP_FILE"
      mv "$TEMP_FILE" "$config"
      NGINX_CHANGED=1
      echo "✓ Added API and frontend location blocks to $config"
    fi
  fi
done

# Step 2: Fix database connection issues
echo "Fixing database connection issues..."

APP_DIR="/opt/speedtest"
ENV_FILE="$APP_DIR/.env"

# Backup .env file if it exists
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$BACKUP_DIR/.env.bak"
  echo "✓ Backed up .env file"
fi

# Create a script to fix the database connection by replacing WebSocket with direct TCP
cat > "$APP_DIR/neon_db_fix.sh" << 'EOF'
#!/bin/bash

echo "Fixing Neon Database connection issues..."

# Check if we need to go into server directory
if [ -d "./server" ]; then
  cd ./server
fi

# Create backup directory
mkdir -p ./backups
BACKUP_DIR="./backups/db_fix_$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Find db.ts file in current or sub directories
DB_FILE=$(find . -name "db.ts" -type f | head -1)

if [ -z "$DB_FILE" ]; then
  echo "Error: Could not find db.ts file"
  exit 1
fi

echo "Found database file: $DB_FILE"
cp "$DB_FILE" "$BACKUP_DIR/db.ts.bak"

# Replace WebSocket connection with direct connection
# Pattern to look for: neon or neondatabase package imports
if grep -q "@neondatabase/serverless" "$DB_FILE"; then
  echo "Found Neon Serverless package, replacing with direct pg connection..."
  
  # Create temp file
  TEMP_FILE=$(mktemp)
  
  # Replace imports and connection setup
  cat "$DB_FILE" | sed '
    # Replace neon import with pg
    s|import { neon[^}]*} from "@neondatabase/serverless"|import { Pool } from "pg"|g
    s|import { drizzle[^}]*} from "drizzle-orm/neon-serverless"|import { drizzle } from "drizzle-orm/node-postgres"|g
    
    # Replace connection setup
    s|const sql = neon(process.env.DATABASE_URL!);|const pool = new Pool({ connectionString: process.env.DATABASE_URL });|g
    s|export const db = drizzle(sql|export const db = drizzle(pool|g
    /neon(/,/);/c\
export const pool = new Pool({ \
  connectionString: process.env.DATABASE_URL,\
});\
\
export const db = drizzle(pool, { schema });
  ' > "$TEMP_FILE"
  
  # Replace original file
  mv "$TEMP_FILE" "$DB_FILE"
  
  echo "✓ Updated $DB_FILE to use direct PostgreSQL connection"
else
  echo "No Neon Serverless package found in $DB_FILE"
fi

echo "Database connection fix complete"
EOF

# Make the script executable
chmod +x "$APP_DIR/neon_db_fix.sh"

# Run the database fix script
echo "Running database connection fix script..."
cd "$APP_DIR" && ./neon_db_fix.sh

# Step 3: Update PORT in environment to match application
echo "Updating PORT in environment files..."

# Check if .env exists
if [ -f "$ENV_FILE" ]; then
  # Update PORT to 5000
  if grep -q "^PORT=" "$ENV_FILE"; then
    sed -i 's/^PORT=.*/PORT=5000/' "$ENV_FILE"
    echo "✓ Updated PORT=5000 in .env file"
  else
    echo "PORT=5000" >> "$ENV_FILE"
    echo "✓ Added PORT=5000 to .env file"
  fi
else
  # Create a basic .env file
  echo "PORT=5000" > "$ENV_FILE"
  echo "✓ Created new .env file with PORT=5000"
fi

# Step 4: Install missing pg package
echo "Installing required PostgreSQL package..."
cd "$APP_DIR"
if [ ! -d "node_modules/pg" ]; then
  npm install pg
  echo "✓ Installed pg package"
else
  echo "pg package already installed"
fi

# Step 5: Test Nginx configuration and restart services
echo "Testing Nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
  echo "✓ Nginx configuration is valid"
  
  if [ $NGINX_CHANGED -eq 1 ]; then
    echo "Reloading Nginx..."
    systemctl reload nginx
    echo "✓ Nginx reloaded"
  fi
else
  echo "! Error in Nginx configuration. Please fix manually."
  echo "  Restore the backup from: $BACKUP_DIR"
  exit 1
fi

# Step 6: Restart the application
echo "Restarting the application..."
if pm2 list | grep -q speedtest; then
  pm2 restart speedtest
  echo "✓ Application restarted with PM2"
else
  cd "$APP_DIR"
  if [ -f "package.json" ]; then
    echo "Starting application with PM2..."
    pm2 start npm --name speedtest -- start
    echo "✓ Started application with PM2"
  else
    echo "! Could not find package.json"
    echo "  Please start the application manually"
  fi
fi

echo ""
echo "=== Fix Complete ==="
echo "The application should now be accessible at http://192.168.8.92"
echo ""
echo "What this fix did:"
echo "1. Updated Nginx to use port 5000 (matching the application's actual port)"
echo "2. Fixed database connection issues by replacing WebSocket with direct TCP"
echo "3. Set PORT=5000 in .env to ensure consistency"
echo "4. Installed the required pg package"
echo "5. Restarted all services"
echo ""
echo "To verify the fix is working:"
echo "1. Try to access the application at http://192.168.8.92"
echo "2. Check Nginx error logs: tail -f /var/log/nginx/error.log"
echo "3. Check application logs: pm2 logs speedtest"
echo ""
echo "If there are still issues, you can restore from the backup in: $BACKUP_DIR"