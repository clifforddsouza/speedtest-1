// Script to convert from PostgreSQL to MySQL
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = '/opt/speedtest';

console.log('Converting database from PostgreSQL to MySQL...');

// Step 1: Install MySQL packages
console.log('Step 1: Installing MySQL packages...');
try {
  await execAsync('npm install mysql2 dotenv');
  console.log('✅ MySQL packages installed');
} catch (error) {
  console.error('Error installing MySQL packages:', error.message);
}

// Step 2: Update drizzle.config.ts to use MySQL
console.log('Step 2: Updating drizzle.config.ts...');
const drizzleConfigPath = path.join(rootDir, 'drizzle.config.ts');
const drizzleConfigBackupPath = drizzleConfigPath + '.pg.bak';

try {
  // Backup original file
  fs.copyFileSync(drizzleConfigPath, drizzleConfigBackupPath);
  
  // Update config file for MySQL
  const newDrizzleConfig = `import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config();

export default {
  schema: "./shared/schema.ts",
  out: "./drizzle",
  driver: 'mysql2',
  dbCredentials: {
    uri: process.env.DATABASE_URL || "mysql://root:password@localhost:3306/speedtest"
  },
} satisfies Config;`;

  fs.writeFileSync(drizzleConfigPath, newDrizzleConfig);
  console.log('✅ Updated drizzle.config.ts');
} catch (error) {
  console.error('Error updating drizzle.config.ts:', error.message);
}

// Step 3: Update server/db.ts
console.log('Step 3: Updating server/db.ts...');
const dbFilePath = path.join(rootDir, 'server/db.ts');
const dbFileBackupPath = dbFilePath + '.pg.bak';

try {
  // Backup original file
  fs.copyFileSync(dbFilePath, dbFileBackupPath);
  
  // Update db.ts file for MySQL
  const newDbContent = `import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../shared/schema';

console.log("Initializing MySQL connection...");

// Parse the connection string
const getConnectionConfig = () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL environment variable is not set");
    return {
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'speedtest'
    };
  }
  
  try {
    // For standard connection strings like: mysql://user:pass@host:port/dbname
    const matches = url.match(/mysql:\\/\\/([^:]+):([^@]+)@([^:]+):?(\\d+)?\\/(.*)/);
    if (matches) {
      const [, user, password, host, port, database] = matches;
      return {
        host,
        user,
        password,
        database,
        port: port ? parseInt(port, 10) : 3306
      };
    }
    
    // Fallback to default
    return {
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'speedtest'
    };
  } catch (err) {
    console.error("Error parsing DATABASE_URL:", err);
    return {
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'speedtest'
    };
  }
};

const connectionConfig = getConnectionConfig();
console.log("MySQL connection config:", { 
  host: connectionConfig.host,
  user: connectionConfig.user,
  database: connectionConfig.database
});

// Create the connection pool
export const pool = mysql.createPool({
  ...connectionConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Add connection status logging
pool.on('connection', () => {
  console.log('Connected to MySQL database');
});

pool.on('error', (err) => {
  console.error('MySQL connection error:', err);
});

export const db = drizzle(pool, { schema, mode: 'default' });`;

  fs.writeFileSync(dbFilePath, newDbContent);
  console.log('✅ Updated server/db.ts');
} catch (error) {
  console.error('Error updating server/db.ts:', error.message);
}

// Step 4: Update shared/schema.ts
console.log('Step 4: Updating shared/schema.ts...');
const schemaFilePath = path.join(rootDir, 'shared/schema.ts');
const schemaFileBackupPath = schemaFilePath + '.pg.bak';

try {
  // Backup original file
  fs.copyFileSync(schemaFilePath, schemaFileBackupPath);
  
  // Read the current schema file
  let schemaContent = fs.readFileSync(schemaFilePath, 'utf8');
  
  // Replace PostgreSQL imports with MySQL imports
  schemaContent = schemaContent.replace(
    /import {.*} from ['"]drizzle-orm\/pg-core['"]/g, 
    `import { mysqlTable, int, varchar, text, boolean, timestamp, decimal, mysqlEnum } from 'drizzle-orm/mysql-core'`
  );
  
  // Replace pgTable with mysqlTable
  schemaContent = schemaContent.replace(/pgTable/g, 'mysqlTable');
  
  // Replace serial() with int().autoincrement() 
  schemaContent = schemaContent.replace(/serial\(\)/g, 'int().autoincrement()');
  
  // Replace timestamp().defaultNow() with timestamp().defaultNow()
  // (this is the same in MySQL, so no change needed)
  
  // Write updated content
  fs.writeFileSync(schemaFilePath, schemaContent);
  console.log('✅ Updated shared/schema.ts');
} catch (error) {
  console.error('Error updating shared/schema.ts:', error.message);
}

// Step 5: Create a test script
console.log('Step 5: Creating test script...');
const testScriptPath = path.join(rootDir, 'test_mysql.mjs');

try {
  const testScriptContent = `import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  let connection;
  
  try {
    console.log("Testing MySQL connection...");
    
    // Parse the connection string
    const getConnectionConfig = () => {
      const url = process.env.DATABASE_URL;
      if (!url) {
        console.error("DATABASE_URL environment variable is not set");
        return {
          host: 'localhost',
          user: 'root',
          password: 'password',
          database: 'speedtest'
        };
      }
      
      try {
        // For standard connection strings like: mysql://user:pass@host:port/dbname
        const matches = url.match(/mysql:\\/\\/([^:]+):([^@]+)@([^:]+):?(\\d+)?\\/(.*)/);
        if (matches) {
          const [, user, password, host, port, database] = matches;
          return {
            host,
            user,
            password,
            database,
            port: port ? parseInt(port, 10) : 3306
          };
        }
        
        // Fallback to default
        return {
          host: 'localhost',
          user: 'root',
          password: 'password',
          database: 'speedtest'
        };
      } catch (err) {
        console.error("Error parsing DATABASE_URL:", err);
        return {
          host: 'localhost',
          user: 'root',
          password: 'password',
          database: 'speedtest'
        };
      }
    };
    
    const connectionConfig = getConnectionConfig();
    console.log("MySQL connection config:", { 
      host: connectionConfig.host,
      user: connectionConfig.user,
      database: connectionConfig.database
    });
    
    connection = await mysql.createConnection(connectionConfig);
    console.log("✅ Successfully connected to MySQL database");
    
    const [rows] = await connection.execute('SELECT NOW() as time');
    console.log("✅ Successfully executed query:", rows[0]);
    
    console.log("Checking database tables...");
    const [tables] = await connection.execute("SHOW TABLES");
    console.log("Database tables:", tables.map(row => Object.values(row)[0]).join(', '));
    
  } catch (err) {
    console.error("❌ MySQL connection error:", err);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testConnection();`;

  fs.writeFileSync(testScriptPath, testScriptContent);
  console.log('✅ Created test script at:', testScriptPath);
} catch (error) {
  console.error('Error creating test script:', error.message);
}

console.log('\n✅ Conversion completed!');
console.log('\nNext steps:');
console.log('1. Set up a MySQL database and update your DATABASE_URL to point to it');
console.log('2. Test the connection: node test_mysql.mjs');
console.log('3. Create the tables: npm run db:push');
console.log('4. Restart the application: pm2 restart speedtest');