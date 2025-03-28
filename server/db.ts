import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSocket for Neon DB
neonConfig.webSocketConstructor = ws;

console.log('Initializing PostgreSQL connection...');

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
export const db = drizzle({ client: pool, schema });
