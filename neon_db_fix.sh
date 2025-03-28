#!/bin/bash

# This script fixes Neon Database connection issues in production

echo "Fixing Neon Database connection issues..."

# Create a backup directory
mkdir -p /opt/speedtest/backups

# Create a modified db.ts file that uses direct connection instead of WebSockets
cat > /opt/speedtest/db_fix.ts << 'EOF'
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "./dist/shared/schema.js";

console.log('Initializing PostgreSQL connection with direct connection (without WebSockets)...');

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure the database pool with robust error handling and optimized settings
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10,                      // Reduced max connections to avoid overwhelming the service
  idleTimeoutMillis: 30000,     // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 5000 // Increased timeout for connection
});

// Add error handling for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on database pool:', err);
});

// Create Drizzle instance with schema
export const db = drizzle(pool, { schema });
EOF

# Install pg package if not already installed
npm install --prefix /opt/speedtest pg

# Update package.json to include the new dependency
if ! grep -q '"pg":' /opt/speedtest/package.json; then
  sed -i 's/"dependencies": {/"dependencies": {\n    "pg": "^8.11.3",/g' /opt/speedtest/package.json
fi

# Backup the original db.ts file before overwriting
cp /opt/speedtest/dist/server/db.js /opt/speedtest/backups/db.js.bak

# Compile the new db.ts file
echo "Compiling the new database connection file..."
cd /opt/speedtest
npx tsc db_fix.ts --outDir ./dist/server --target es2022 --module nodenext --esModuleInterop true

# Rename the compiled file to db.js
mv ./dist/server/db_fix.js ./dist/server/db.js

echo ""
echo "Fixed database connection. Restart your application with: pm2 restart speedtest"