import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import crypto from 'crypto';
import express from 'express';
import { insertSpeedTestSchema, UserRole } from "@shared/schema";
import { z } from "zod";
import { setupAuth, isAdmin } from "./auth";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { WebSocket, WebSocketServer } from 'ws';

// For creating the initial admin user
const scryptAsync = promisify(scrypt);
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);

  // Speed test endpoints for high bandwidth testing
  app.get('/api/speedtest/download', (req, res) => {
    const size = parseInt(req.query.size as string) || 25 * 1024 * 1024; // 25MB chunks
    const buffer = crypto.randomBytes(size);
    res.send(buffer);
  });

  app.post('/api/speedtest/upload', express.raw({limit: '50mb', type: '*/*'}), (req, res) => {
    res.sendStatus(200);
  });
  
  // Admin dashboard session check
  app.get("/api/admin/session", isAdmin, (req: Request, res: Response) => {
    // If the isAdmin middleware passes, this means user is authenticated and has admin role
    const user = req.user!;
    res.status(200).json({ 
      isAuthenticated: true,
      username: user.username,
      role: user.role
    });
  });
  
  // Admin dashboard analytics (get all speed tests)
  app.get("/api/admin/speed-tests", isAdmin, async (req, res) => {
    try {
      const tests = await storage.getSpeedTests();
      res.json(tests);
    } catch (error) {
      console.error("Error fetching speed tests for admin:", error);
      res.status(500).json({ message: "Failed to fetch speed tests" });
    }
  });
  
  // Admin dashboard - get all users (available only to admins)
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      // Don't send passwords to the client
      const usersWithoutPasswords = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Error fetching users for admin:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  // Admin dashboard - register new user (available only to admins)
  app.post("/api/admin/register", isAdmin, async (req, res) => {
    try {
      const { username, password, role } = req.body;
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      // Create the user
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        role
      });
      
      // Don't send password back to client
      const { password: _, ...userWithoutPassword } = user;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });
  
  // Create default super admin user if none exists
  (async () => {
    try {
      // Check if there's at least one super admin
      const users = await storage.getUsers();
      const hasAdmin = users.some(user => user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN);
      
      if (!hasAdmin && users.length === 0) {
        console.log("Creating default super admin user...");
        // Create a default super admin user
        const adminPassword = await hashPassword("admin");
        await storage.createUser({
          username: "admin",
          password: adminPassword,
          role: UserRole.SUPER_ADMIN
        });
        console.log("Default super admin user created successfully");
      }
    } catch (error) {
      console.error("Error during admin setup:", error);
    }
  })();
  // Speed test API routes
  app.get("/api/speed-tests", async (req, res) => {
    try {
      const customerId = req.query.customerId as string | undefined;
      
      if (customerId) {
        const tests = await storage.getSpeedTestsByCustomerId(customerId);
        res.json(tests);
      } else {
        const tests = await storage.getSpeedTests();
        res.json(tests);
      }
    } catch (error) {
      console.error("Error fetching speed tests:", error);
      res.status(500).json({ message: "Failed to fetch speed tests" });
    }
  });

  app.get("/api/speed-tests/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }
      
      const test = await storage.getSpeedTest(id);
      if (!test) {
        return res.status(404).json({ message: "Speed test not found" });
      }
      
      res.json(test);
    } catch (error) {
      console.error("Error fetching speed test:", error);
      res.status(500).json({ message: "Failed to fetch speed test" });
    }
  });

  app.post("/api/speed-tests", async (req, res) => {
    try {
      console.log("Received speed test data:", JSON.stringify(req.body, null, 2));
      
      const parsedBody = insertSpeedTestSchema.safeParse(req.body);
      
      if (!parsedBody.success) {
        return res.status(400).json({ 
          message: "Invalid speed test data",
          errors: parsedBody.error.format() 
        });
      }
      
      // Ensure packet loss is properly set as a number
      if (parsedBody.data.packetLoss !== undefined && parsedBody.data.packetLoss !== null) {
        // Convert to number if it's a string
        parsedBody.data.packetLoss = Number(parsedBody.data.packetLoss);
      }
      
      console.log("Validated speed test data:", JSON.stringify(parsedBody.data, null, 2));
      
      // Always store the test - no time restriction
      const speedTest = await storage.createSpeedTest(parsedBody.data);
      console.log("Saved speed test:", JSON.stringify(speedTest, null, 2));
      
      res.status(201).json({
        ...speedTest,
        testComplete: true,
        testStored: true
      });
    } catch (error) {
      console.error("Error creating speed test:", error);
      res.status(500).json({ message: "Failed to save speed test data" });
    }
  });

  // Packet loss measurement endpoint (legacy - now uses WebSockets for more accurate measurement)
  app.post("/api/measure-packet-loss", async (req, res) => {
    try {
      // This endpoint is kept for backwards compatibility
      // The WebSocket-based packet loss test is more accurate and should be used instead
      
      // Return a response indicating that real packet loss measurement requires WebSockets
      res.json({
        message: "This endpoint is deprecated. The application now uses WebSockets for real packet loss measurement.",
        recommendation: "Use the WebSocket-based packet loss test for accurate results."
      });
    } catch (error) {
      console.error("Error in packet loss endpoint:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  const httpServer = createServer(app);
  
  // Set up WebSocket server for packet loss testing
  const wss = new WebSocketServer({ server: httpServer, path: '/api/ws-packet-test' });
  
  // Track active packet loss tests
  const packetLossTests = new Map<string, {
    id: string;
    sentPackets: number;
    receivedPackets: number;
    startTime: number;
    lastActivity: number;
  }>();
  
  // No artificial packet loss - we'll measure real network conditions
  
  // Clean up inactive tests periodically
  setInterval(() => {
    const now = Date.now();
    // Use Array.from to avoid TypeScript iteration error
    Array.from(packetLossTests.entries()).forEach(([id, test]) => {
      // Remove tests that have been inactive for more than 30 seconds
      if (now - test.lastActivity > 30000) {
        packetLossTests.delete(id);
        console.log(`Removed inactive packet loss test ${id}`);
      }
    });
  }, 10000);
  
  wss.on('connection', (ws: WebSocket) => {
    console.log('New WebSocket connection for packet loss test');
    let testId: string | null = null;
    
    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle different message types
        switch (data.type) {
          case 'init': {
            // Initialize new test
            testId = crypto.randomUUID();
            packetLossTests.set(testId, {
              id: testId,
              sentPackets: 0,
              receivedPackets: 0,
              startTime: Date.now(),
              lastActivity: Date.now()
            });
            
            ws.send(JSON.stringify({
              type: 'init',
              testId,
              status: 'ready'
            }));
            
            console.log(`Initialized packet loss test ${testId} - measuring real network conditions`);
            break;
          }
          
          case 'packet': {
            // Record received packet
            if (!testId || !packetLossTests.has(testId)) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'No active test session'
              }));
              return;
            }
            
            const test = packetLossTests.get(testId)!;
            test.receivedPackets++;
            test.lastActivity = Date.now();
            
            // Always acknowledge received packets - we're measuring real network packet loss
            ws.send(JSON.stringify({
              type: 'ack',
              packetId: data.packetId
            }));
            
            // Log every 20th packet for debugging
            if (data.packetId % 20 === 0) {
              console.log(`Received and acknowledged packet ${data.packetId}`);
            }
            break;
          }
          
          case 'client-sent': {
            // Client reports how many packets it sent
            if (!testId || !packetLossTests.has(testId)) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'No active test session'
              }));
              return;
            }
            
            const test = packetLossTests.get(testId)!;
            test.sentPackets = data.count;
            test.lastActivity = Date.now();
            break;
          }
          
          case 'get-results': {
            // Return test results
            if (!testId || !packetLossTests.has(testId)) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'No active test session'
              }));
              return;
            }
            
            const test = packetLossTests.get(testId)!;
            const lostPackets = test.sentPackets - test.receivedPackets;
            const packetLossPercentage = test.sentPackets > 0 
              ? (lostPackets / test.sentPackets) * 100 
              : 0;
            
            ws.send(JSON.stringify({
              type: 'results',
              sentPackets: test.sentPackets,
              receivedPackets: test.receivedPackets,
              lostPackets,
              packetLossPercentage: parseFloat(packetLossPercentage.toFixed(2)),
              duration: Date.now() - test.startTime
            }));
            
            console.log(`Packet loss test ${testId} results: ${lostPackets} lost out of ${test.sentPackets} (${packetLossPercentage.toFixed(2)}%)`);
            
            // Optionally clean up after results are retrieved
            packetLossTests.delete(testId);
            break;
          }
          
          default:
            ws.send(JSON.stringify({
              type: 'error',
              message: `Unknown message type: ${data.type}`
            }));
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket connection closed');
      if (testId && packetLossTests.has(testId)) {
        packetLossTests.delete(testId);
        console.log(`Cleaned up packet loss test ${testId} on connection close`);
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (testId && packetLossTests.has(testId)) {
        packetLossTests.delete(testId);
      }
    });
  });

  return httpServer;
}
