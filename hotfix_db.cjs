#!/usr/bin/env node

// This script directly replaces the Neon WebSocket connection with a direct PostgreSQL connection
// It's designed to be run as a standalone script to immediately fix the database connection
// Run with: node hotfix_db.cjs

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec: execCallback } = require('child_process');

// Promisify for better async handling
const exec = promisify(execCallback);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// Base directory
const baseDir = '/opt/speedtest';
const distDir = path.join(baseDir, 'dist');
const serverDir = path.join(distDir, 'server');
const backupDir = path.join(baseDir, 'backups', `hotfix_${new Date().toISOString().replace(/[:.]/g, '_')}`);

async function fixDatabase() {
  try {
    console.log('=== SpeedTest Database Hotfix ===');
    
    // Create backup directory
    await mkdir(backupDir, { recursive: true });
    console.log(`Created backup directory: ${backupDir}`);
    
    // Install pg package if not present
    try {
      console.log('Checking if pg package is installed...');
      await exec('npm list pg');
      console.log('pg package is already installed');
    } catch (err) {
      console.log('Installing pg package...');
      await exec('npm install pg');
      console.log('✓ pg package installed');
    }
    
    // Find db.js in the compiled directory
    const dbJsPath = path.join(serverDir, 'db.js');
    let found = false;
    
    if (fs.existsSync(dbJsPath)) {
      found = true;
      console.log(`Found db.js at: ${dbJsPath}`);
      
      // Back up the file
      const backupPath = path.join(backupDir, 'db.js.bak');
      fs.copyFileSync(dbJsPath, backupPath);
      console.log(`✓ Created backup at: ${backupPath}`);
      
      // Create the new db.js file
      const newDbJs = `
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema.js';

console.log('Initializing PostgreSQL connection with direct connection...');

const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const db = drizzle(pool, { schema });
`;
      
      // Write the new file
      await writeFile(dbJsPath, newDbJs);
      console.log(`✓ Updated ${dbJsPath} with direct PostgreSQL connection`);
    }
    
    if (!found) {
      console.log('Could not find db.js in expected location. Searching...');
      
      // Search for db.js in dist directory
      try {
        const { stdout } = await exec(`find ${distDir} -name "db.js" -type f`);
        const files = stdout.trim().split('\n');
        
        if (files.length > 0 && files[0]) {
          const foundPath = files[0];
          console.log(`Found db.js at: ${foundPath}`);
          
          // Back up the file
          const backupPath = path.join(backupDir, 'db.js.bak');
          fs.copyFileSync(foundPath, backupPath);
          console.log(`✓ Created backup at: ${backupPath}`);
          
          // Create the new db.js file
          const newDbJs = `
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema.js';

console.log('Initializing PostgreSQL connection with direct connection...');

const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const db = drizzle(pool, { schema });
`;
          
          // Write the new file
          await writeFile(foundPath, newDbJs);
          console.log(`✓ Updated ${foundPath} with direct PostgreSQL connection`);
          found = true;
        }
      } catch (err) {
        console.log('Error searching for db.js:', err.message);
      }
    }
    
    if (!found) {
      console.log('! Could not find compiled db.js file. Will try to create it.');
      
      // Create a new db.js file in the server directory
      if (!fs.existsSync(serverDir)) {
        await mkdir(serverDir, { recursive: true });
        console.log(`Created server directory: ${serverDir}`);
      }
      
      const newDbJsPath = path.join(serverDir, 'db.js');
      const newDbJs = `
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema.js';

console.log('Initializing PostgreSQL connection with direct connection...');

const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const db = drizzle(pool, { schema });
`;
      
      // Write the new file
      await writeFile(newDbJsPath, newDbJs);
      console.log(`✓ Created new ${newDbJsPath} with direct PostgreSQL connection`);
    }
    
    // Restart the application
    console.log('Restarting the application...');
    try {
      await exec('pm2 restart speedtest');
      console.log('✓ Restarted application');
    } catch (err) {
      console.log('! Could not restart application with PM2');
      console.log('  Please restart the application manually');
    }
    
    console.log('\n=== Hotfix Complete ===');
    console.log('The database connection should now be working properly.');
    console.log('Check the application logs with: pm2 logs speedtest');
    
  } catch (err) {
    console.error('Error applying hotfix:', err);
  }
}

fixDatabase();