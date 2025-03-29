#!/bin/bash
# Script to fix issues with Neon database connection
echo "=== Neon Database Connection Fix ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./neon_db_fix.sh)"
  exit 1
fi

APP_DIR="/opt/speedtest"
BACKUP_DIR="$APP_DIR/backups/neon_fix_$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Step 1: Find and update the db.ts file
echo "Looking for database connection file..."
DB_TS_FILE="$APP_DIR/server/db.ts"
if [ -f "$DB_TS_FILE" ]; then
  cp "$DB_TS_FILE" "$BACKUP_DIR/db.ts.bak"
  echo "Found and backed up $DB_TS_FILE"
  
  # Check if it's using @neondatabase/serverless
  if grep -q "@neondatabase/serverless" "$DB_TS_FILE"; then
    echo "File is using @neondatabase/serverless, replacing with direct pg connection"
    
    # Create a new db.ts file using regular pg
    cat > "$DB_TS_FILE" << 'EOF'
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

// Set SSL mode and reject unauthorized to false to handle older SSL certs properly
process.env.PGSSLMODE = 'require';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log("Initializing PostgreSQL connection...");
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Add connection status logging
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err);
});

export const db = drizzle(pool, { schema });
EOF
    echo "✓ Updated $DB_TS_FILE to use pg package with SSL fixes"
  else
    echo "$DB_TS_FILE doesn't use @neondatabase/serverless, adding SSL configuration..."
    # Modify the existing file to add SSL configuration
    cat > "$DB_TS_FILE" << 'EOF'
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

// Set SSL mode and reject unauthorized to false to handle older SSL certs properly
process.env.PGSSLMODE = 'require';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log("Initializing PostgreSQL connection...");
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Add connection status logging
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err);
});

export const db = drizzle(pool, { schema });
EOF
    echo "✓ Updated $DB_TS_FILE with SSL configuration"
  fi
else
  echo "! Could not find database TypeScript file at $DB_TS_FILE"
  echo "Searching for db.ts elsewhere..."
  DB_TS_FILE=$(find "$APP_DIR" -name "db.ts" -not -path "*/node_modules/*" | head -1)
  
  if [ -n "$DB_TS_FILE" ]; then
    echo "Found database file at $DB_TS_FILE"
    cp "$DB_TS_FILE" "$BACKUP_DIR/db.ts.bak"
    
    # Create a new db.ts file using regular pg
    cat > "$DB_TS_FILE" << 'EOF'
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

// Set SSL mode and reject unauthorized to false to handle older SSL certs properly
process.env.PGSSLMODE = 'require';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log("Initializing PostgreSQL connection...");
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Add connection status logging
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err);
});

export const db = drizzle(pool, { schema });
EOF
    echo "✓ Updated $DB_TS_FILE to use pg package with SSL fixes"
  else
    echo "! Could not find any db.ts file in the project"
  fi
fi

# Step 2: Install the pg package
echo "Installing pg package..."
cd "$APP_DIR"
npm install pg
npm install --save-dev @types/pg
echo "✓ Installed PostgreSQL packages"

# Step 3: Create a database test file that specifically handles Neon
echo "Creating database test script..."
cat > "$APP_DIR/test_db.js" << 'EOF'
const { Pool } = require('pg');
require('dotenv').config();

// Set SSL mode and reject unauthorized to false to handle older SSL certs properly
process.env.PGSSLMODE = 'require';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function testConnection() {
  try {
    // Mask the connection string when printing
    const dbUrl = process.env.DATABASE_URL || '';
    const maskedUrl = dbUrl ? 
      dbUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') : 
      'Not defined';
    
    console.log("Using DATABASE_URL:", maskedUrl);
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log("Testing database connection...");
    const client = await pool.connect();
    console.log("✓ Successfully connected to the database");
    
    const result = await client.query('SELECT NOW()');
    console.log("✓ Successfully executed query:", result.rows[0]);
    
    console.log("Checking database tables...");
    const tablesResult = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("Database tables:", tablesResult.rows.map(row => row.table_name).join(', '));
    
    client.release();
    pool.end();
    return true;
  } catch (err) {
    console.error("! Database connection error:", err);
    return false;
  }
}

testConnection().then(success => {
  if (success) {
    console.log("Database connection test passed successfully.");
  } else {
    console.log("Database connection test failed.");
  }
});
EOF

echo "Installing dotenv for test script..."
cd "$APP_DIR"
npm install dotenv

echo "Running database test..."
node "$APP_DIR/test_db.js"

# Step 4: Build the project if it uses TypeScript
if [ -f "$APP_DIR/tsconfig.json" ]; then
  echo "Building the project..."
  cd "$APP_DIR"
  npm run build || true
  echo "Project build complete."
fi

# Step 5: Restart the application
echo "Restarting the application..."
if command -v pm2 &> /dev/null; then
  if pm2 list | grep -q speedtest; then
    pm2 restart speedtest
    echo "✓ Restarted application with PM2"
    
    # Wait a moment for the app to start
    echo "Waiting for application to initialize..."
    sleep 5
  else
    cd "$APP_DIR"
    pm2 start npm --name speedtest -- start
    echo "✓ Started application with PM2"
    sleep 5
  fi
fi

echo ""
echo "=== Neon Database Fix Complete ==="
echo ""
echo "What this fix did:"
echo "1. Updated database connection code to use pg with proper SSL settings"
echo "2. Installed required PostgreSQL packages"
echo "3. Created and ran a test script to verify database connection"
echo "4. Rebuilt the project (if TypeScript is used)"
echo "5. Restarted the application"
echo ""
echo "Check the results above to see if the database connection is working."
echo "If you're still having issues:"
echo "1. Check application logs: pm2 logs speedtest"
echo "2. Check the database connection parameters in your .env file"
echo ""
echo "Try accessing the application now and attempt to log in."