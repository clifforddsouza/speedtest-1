#!/bin/bash

# This script fixes Neon Database connection issues by replacing WebSocket connections with direct TCP
# It addresses the common ECONNREFUSED errors when using WebSocket connections to Neon

echo "=== Fixing Neon Database connection issues ==="

# Work in the application directory
APP_DIR="/opt/speedtest"
cd "$APP_DIR" || { echo "Error: Could not cd to $APP_DIR"; exit 1; }

# Create backup directory
BACKUP_DIR="./backups/db_fix_$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Step 1: Find the database connection file
echo "Looking for database connection file..."
DB_FILE=""

# Common locations for the db.ts file
POSSIBLE_LOCATIONS=(
  "./server/db.ts"
  "./db.ts"
  "./src/db.ts"
  "./server/src/db.ts"
  "./shared/db.ts"
)

for location in "${POSSIBLE_LOCATIONS[@]}"; do
  if [ -f "$location" ]; then
    DB_FILE="$location"
    break
  fi
done

# If not found in common locations, search for it
if [ -z "$DB_FILE" ]; then
  echo "Searching for db.ts file..."
  DB_FILE=$(find . -name "db.ts" -type f | head -1)
fi

if [ -z "$DB_FILE" ]; then
  echo "Error: Could not find db.ts file. Looking for other database files..."
  DB_FILE=$(find . -type f -name "*.ts" -exec grep -l "neon" {} \; | head -1)
  
  if [ -z "$DB_FILE" ]; then
    echo "Error: Could not find any database connection files"
    exit 1
  fi
fi

echo "Found database file: $DB_FILE"
cp "$DB_FILE" "$BACKUP_DIR/$(basename "$DB_FILE").bak"
echo "✓ Created backup of original file"

# Step 2: Install required PostgreSQL driver if not present
echo "Checking for pg package..."
if [ ! -d "node_modules/pg" ]; then
  echo "Installing pg package..."
  npm install pg
  echo "✓ Installed pg package"
else
  echo "pg package already installed"
fi

# Step 3: Check for types package as well
if [ ! -d "node_modules/@types/pg" ]; then
  echo "Installing @types/pg package..."
  npm install --save-dev @types/pg
  echo "✓ Installed @types/pg package"
fi

# Step 4: Replace WebSocket connection with direct connection
echo "Replacing WebSocket connection with direct PostgreSQL connection..."

# Create temporary file
TEMP_FILE=$(mktemp)

# Check what kind of imports and connection setup is used
if grep -q "@neondatabase/serverless" "$DB_FILE"; then
  echo "Found Neon Serverless package, replacing with direct pg connection..."
  
  # Replace imports and connection setup
  cat "$DB_FILE" | sed '
    # Replace neon import with pg
    s|import { neon[^}]*} from "@neondatabase/serverless"|import { Pool } from "pg"|g
    s|import { drizzle[^}]*} from "drizzle-orm/neon-serverless"|import { drizzle } from "drizzle-orm/node-postgres"|g
    
    # Replace connection setup (common patterns)
    s|const sql = neon(process.env.DATABASE_URL!);|const pool = new Pool({ connectionString: process.env.DATABASE_URL });|g
    s|const sql = neon(process.env.DATABASE_URL);|const pool = new Pool({ connectionString: process.env.DATABASE_URL });|g
    s|export const db = drizzle(sql|export const db = drizzle(pool|g
    
    # If line has neon( function call, replace entire connection block
    /neon(/,/);/ {
      c\
export const pool = new Pool({ \
  connectionString: process.env.DATABASE_URL,\
});\
\
export const db = drizzle(pool);
    }
  ' > "$TEMP_FILE"
  
  # If the file contains schema imports, adjust the drizzle initialization
  if grep -q "schema" "$TEMP_FILE"; then
    sed -i '/export const db = drizzle(pool);/c\
export const db = drizzle(pool, { schema });' "$TEMP_FILE"
  fi
  
  # Replace original file
  mv "$TEMP_FILE" "$DB_FILE"
  echo "✓ Updated $DB_FILE to use direct PostgreSQL connection"
else
  echo "No Neon Serverless package found in $DB_FILE. Looking for other patterns..."
  
  # Look for other common patterns
  if grep -q "drizzle.*neon" "$DB_FILE"; then
    # File has drizzle with neon but not the standard imports
    cat "$DB_FILE" | sed '
      # Replace any drizzle-orm/neon imports
      s|from "drizzle-orm/neon.*"|from "drizzle-orm/node-postgres"|g
      
      # Add Pool import if pg not already imported
      /import.*pg/ ! {
        1 i\
import { Pool } from "pg";
      }
      
      # Replace any neon connection setup
      s|const [a-zA-Z0-9_]* = neon(.*);|const pool = new Pool({ connectionString: process.env.DATABASE_URL });|g
      s|drizzle(.*neon.*)|drizzle(pool)|g
    ' > "$TEMP_FILE"
    
    mv "$TEMP_FILE" "$DB_FILE"
    echo "✓ Updated $DB_FILE with custom pattern replacement"
  else
    echo "! Could not identify database connection pattern in $DB_FILE"
    echo "  Manual inspection required"
    
    # Create a new version with common replacements as a guide
    echo "Creating example conversion in $BACKUP_DIR/db.ts.converted"
    cat > "$BACKUP_DIR/db.ts.converted" << 'EOF'
// EXAMPLE CONVERSION - Adjust this to match your actual code structure

// OLD IMPORTS (commented out):
// import { neon } from "@neondatabase/serverless";
// import { drizzle } from "drizzle-orm/neon-serverless";

// NEW IMPORTS:
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

// OLD CONNECTION (commented out):
// const sql = neon(process.env.DATABASE_URL!);
// export const db = drizzle(sql);

// NEW CONNECTION:
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

export const db = drizzle(pool, { schema });

console.log("Initializing PostgreSQL connection...");
EOF
  fi
fi

# Step 5: Update any imports in other files if necessary
echo "Checking for other files that might need updates..."
OTHER_FILES=$(grep -r --include="*.ts" "drizzle-orm/neon" . | cut -d: -f1 | sort -u)

if [ -n "$OTHER_FILES" ]; then
  echo "Found other files with neon imports that need updating:"
  
  for file in $OTHER_FILES; do
    if [ "$file" != "$DB_FILE" ]; then
      echo "Updating $file..."
      cp "$file" "$BACKUP_DIR/$(basename "$file").bak"
      
      sed -i 's|drizzle-orm/neon-serverless|drizzle-orm/node-postgres|g' "$file"
      sed -i 's|drizzle-orm/neon-http|drizzle-orm/node-postgres|g' "$file"
      echo "✓ Updated $file"
    fi
  done
else
  echo "No other files found that need updating"
fi

# Step 6: Update .env file
ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$BACKUP_DIR/.env.bak"
  
  # If DATABASE_URL starts with postgres:// change it to postgresql://
  if grep -q "^DATABASE_URL=postgres://" "$ENV_FILE"; then
    sed -i 's|^DATABASE_URL=postgres://|DATABASE_URL=postgresql://|' "$ENV_FILE"
    echo "✓ Updated DATABASE_URL protocol in .env file"
  fi
  
  # Ensure SESSION_SECRET exists
  if ! grep -q "^SESSION_SECRET=" "$ENV_FILE"; then
    echo "SESSION_SECRET=$(openssl rand -hex 32)" >> "$ENV_FILE"
    echo "✓ Added SESSION_SECRET to .env file"
  fi
  
  echo "✓ Updated .env file"
else
  echo "! No .env file found"
fi

# Step 7: Restart the application
echo "Restarting the application..."
if command -v pm2 &> /dev/null && pm2 list | grep -q speedtest; then
  pm2 restart speedtest
  echo "✓ Restarted application with PM2"
else
  echo "! Could not restart application with PM2"
  echo "  Please restart the application manually"
fi

echo ""
echo "=== Database Fix Complete ==="
echo ""
echo "Changes made:"
echo "1. Replaced WebSocket-based Neon connection with direct PostgreSQL connection"
echo "2. Installed pg and @types/pg packages if needed"
echo "3. Updated imports in other files if necessary"
echo "4. Updated DATABASE_URL protocol if needed"
echo "5. Restarted the application"
echo ""
echo "If you still experience issues:"
echo "1. Check application logs with: pm2 logs speedtest"
echo "2. You can restore from backups in: $BACKUP_DIR"
echo "3. Try creating a simple database test script:"
echo ""
echo "Create a file named test_db.js with the following content:"
echo "----"
echo "const { Pool } = require('pg');"
echo "require('dotenv').config();"
echo ""
echo "const pool = new Pool({"
echo "  connectionString: process.env.DATABASE_URL"
echo "});"
echo ""
echo "async function testConnection() {"
echo "  try {"
echo "    const client = await pool.connect();"
echo "    console.log('Database connection successful');"
echo "    const result = await client.query('SELECT NOW()');"
echo "    console.log('Database time:', result.rows[0].now);"
echo "    client.release();"
echo "  } catch (err) {"
echo "    console.error('Database connection error:', err);"
echo "  } finally {"
echo "    pool.end();"
echo "  }"
echo "}"
echo ""
echo "testConnection();"
echo "----"
echo ""
echo "Then run: node test_db.js"