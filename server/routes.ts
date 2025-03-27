import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import crypto from 'crypto';
import express from 'express';
import { insertSpeedTestSchema, insertInternetPlanSchema, UserRole, type InsertSpeedTest } from "@shared/schema";
import { z } from "zod";
import { setupAuth, isAdmin } from "./auth";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { WebSocket, WebSocketServer } from 'ws';
import os from 'os';

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
  
  // Server monitoring endpoint for administrators
  app.get("/api/admin/server-status", isAdmin, (req, res) => {
    try {
      // Gather performance metrics
      const status = {
        uptime: process.uptime(),
        timestamp: Date.now(),
        cpuUsage: process.cpuUsage(),
        memoryUsage: process.memoryUsage(),
        loadAverage: os.loadavg(),
        cpuCount: os.cpus().length,
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        connections: {
          active: activeConnections.size,
          max: MAX_CONCURRENT_TESTS,
          activeTests: packetLossTests.size
        },
        platform: process.platform,
        nodeVersion: process.version
      };
      
      res.json(status);
    } catch (error) {
      console.error("Error fetching server status:", error);
      res.status(500).json({ message: "Failed to fetch server status" });
    }
  });
  
  // Admin dashboard endpoints are defined in auth.ts
  
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

  // Internet plan API routes
  app.get("/api/internet-plans", async (req, res) => {
    try {
      const plans = await storage.getInternetPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching internet plans:", error);
      res.status(500).json({ message: "Failed to fetch internet plans" });
    }
  });

  app.get("/api/internet-plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }
      
      const plan = await storage.getInternetPlan(id);
      if (!plan) {
        return res.status(404).json({ message: "Internet plan not found" });
      }
      
      res.json(plan);
    } catch (error) {
      console.error("Error fetching internet plan:", error);
      res.status(500).json({ message: "Failed to fetch internet plan" });
    }
  });

  app.post("/api/internet-plans", isAdmin, async (req, res) => {
    try {
      const parsedBody = insertInternetPlanSchema.safeParse(req.body);
      
      if (!parsedBody.success) {
        return res.status(400).json({ 
          message: "Invalid internet plan data",
          errors: parsedBody.error.format() 
        });
      }
      
      const plan = await storage.createInternetPlan(parsedBody.data);
      res.status(201).json(plan);
    } catch (error) {
      console.error("Error creating internet plan:", error);
      res.status(500).json({ message: "Failed to create internet plan" });
    }
  });

  app.put("/api/internet-plans/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }
      
      const plan = await storage.getInternetPlan(id);
      if (!plan) {
        return res.status(404).json({ message: "Internet plan not found" });
      }
      
      const parsedBody = insertInternetPlanSchema.partial().safeParse(req.body);
      
      if (!parsedBody.success) {
        return res.status(400).json({ 
          message: "Invalid internet plan data",
          errors: parsedBody.error.format() 
        });
      }
      
      const updatedPlan = await storage.updateInternetPlan(id, parsedBody.data);
      res.json(updatedPlan);
    } catch (error) {
      console.error("Error updating internet plan:", error);
      res.status(500).json({ message: "Failed to update internet plan" });
    }
  });

  app.delete("/api/internet-plans/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }
      
      const plan = await storage.getInternetPlan(id);
      if (!plan) {
        return res.status(404).json({ message: "Internet plan not found" });
      }
      
      await storage.deleteInternetPlan(id);
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting internet plan:", error);
      res.status(500).json({ message: "Failed to delete internet plan" });
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
  
  // Batch submission endpoint for multiple test results
  app.post("/api/speed-tests/batch", async (req, res) => {
    try {
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ 
          message: "Expected an array of speed test data" 
        });
      }
      
      console.log(`Received batch of ${req.body.length} speed tests`);
      
      // Validate each test in the batch
      const validTests: InsertSpeedTest[] = [];
      const invalidTests: { index: number; errors: any }[] = [];
      
      req.body.forEach((testData, index) => {
        const parsedTest = insertSpeedTestSchema.safeParse(testData);
        
        if (parsedTest.success) {
          // Ensure packet loss is properly set as a number
          if (parsedTest.data.packetLoss !== undefined && parsedTest.data.packetLoss !== null) {
            parsedTest.data.packetLoss = Number(parsedTest.data.packetLoss);
          }
          validTests.push(parsedTest.data);
        } else {
          invalidTests.push({
            index,
            errors: parsedTest.error.format()
          });
        }
      });
      
      console.log(`Validated ${validTests.length} tests, found ${invalidTests.length} invalid tests`);
      
      // Only process if we have valid tests
      if (validTests.length === 0) {
        return res.status(400).json({
          message: "No valid tests in the batch",
          invalidTests
        });
      }
      
      // Store the valid tests in a batch operation
      const savedTests = await storage.createSpeedTestsBatch(validTests);
      
      res.status(201).json({
        message: `Successfully stored ${savedTests.length} tests`,
        savedCount: savedTests.length,
        invalidCount: invalidTests.length,
        invalidTests: invalidTests.length > 0 ? invalidTests : undefined
      });
    } catch (error) {
      console.error("Error processing batch speed test submission:", error);
      res.status(500).json({ message: "Failed to process batch submission" });
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
  
  // Track active connections and set limits for concurrent testing
  const activeConnections = new Map<string, {
    ws: WebSocket;
    startTime: number;
    lastActivity: number;
    testId?: string;
  }>();
  
  const MAX_CONCURRENT_TESTS = 20; // Set limit higher than needed (10-15)
  
  // Track active packet loss tests
  const packetLossTests = new Map<string, {
    id: string;
    sentPackets: number;
    receivedPackets: number;
    startTime: number;
    lastActivity: number;
    connectionId: string;
  }>();
  
  // No artificial packet loss - we'll measure real network conditions
  
  // Clean up inactive tests and connections periodically
  setInterval(() => {
    const now = Date.now();
    // Clean up inactive tests
    Array.from(packetLossTests.entries()).forEach(([id, test]) => {
      // Remove tests that have been inactive for more than 30 seconds
      if (now - test.lastActivity > 30000) {
        packetLossTests.delete(id);
        console.log(`Removed inactive packet loss test ${id}`);
      }
    });
    
    // Clean up inactive connections
    Array.from(activeConnections.entries()).forEach(([id, conn]) => {
      // Remove connections that have been inactive for more than 60 seconds
      if (now - conn.lastActivity > 60000) {
        if (conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.close();
        }
        activeConnections.delete(id);
        console.log(`Removed inactive connection ${id}`);
      }
    });
  }, 10000);
  
  wss.on('connection', (ws: WebSocket) => {
    console.log('New WebSocket connection for packet loss test');
    
    // Generate a unique connection ID
    const connectionId = crypto.randomUUID();
    let testId: string | null = null;
    
    // Check if we're at connection limit
    if (activeConnections.size >= MAX_CONCURRENT_TESTS) {
      console.log(`Connection limit reached (${activeConnections.size}/${MAX_CONCURRENT_TESTS}). Rejecting new connection.`);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Server is at capacity. Please try again later.'
      }));
      ws.close();
      return;
    }
    
    // Store the connection
    activeConnections.set(connectionId, {
      ws,
      startTime: Date.now(),
      lastActivity: Date.now()
    });
    
    console.log(`Active connections: ${activeConnections.size}/${MAX_CONCURRENT_TESTS}`);
    
    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Update last activity time for this connection
        const conn = activeConnections.get(connectionId);
        if (conn) {
          conn.lastActivity = Date.now();
        }
        
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
              lastActivity: Date.now(),
              connectionId
            });
            
            // Update connection with testId
            const conn = activeConnections.get(connectionId);
            if (conn) {
              conn.testId = testId;
            }
            
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
      
      // Clean up test if exists
      if (testId && packetLossTests.has(testId)) {
        packetLossTests.delete(testId);
        console.log(`Cleaned up packet loss test ${testId} on connection close`);
      }
      
      // Clean up connection tracking
      activeConnections.delete(connectionId);
      console.log(`Connection ${connectionId} closed. Active connections: ${activeConnections.size}/${MAX_CONCURRENT_TESTS}`);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      
      // Clean up test if exists
      if (testId && packetLossTests.has(testId)) {
        packetLossTests.delete(testId);
      }
      
      // Clean up connection tracking
      activeConnections.delete(connectionId);
      console.log(`Connection ${connectionId} closed due to error. Active connections: ${activeConnections.size}/${MAX_CONCURRENT_TESTS}`);
    });
  });

  // Internet plan API routes
  app.get("/api/internet-plans", async (req, res) => {
    try {
      const plans = await storage.getInternetPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching internet plans:", error);
      res.status(500).json({ message: "Failed to fetch internet plans" });
    }
  });

  app.get("/api/internet-plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }
      
      const plan = await storage.getInternetPlan(id);
      if (!plan) {
        return res.status(404).json({ message: "Internet plan not found" });
      }
      
      res.json(plan);
    } catch (error) {
      console.error("Error fetching internet plan:", error);
      res.status(500).json({ message: "Failed to fetch internet plan" });
    }
  });

  app.post("/api/internet-plans", isAdmin, async (req, res) => {
    try {
      const parsedBody = insertInternetPlanSchema.safeParse(req.body);
      
      if (!parsedBody.success) {
        return res.status(400).json({ 
          message: "Invalid internet plan data",
          errors: parsedBody.error.format() 
        });
      }
      
      // Check if a plan with the same name already exists
      const existingPlan = await storage.getInternetPlanByName(parsedBody.data.name);
      if (existingPlan) {
        return res.status(409).json({ message: "An internet plan with this name already exists" });
      }
      
      const plan = await storage.createInternetPlan(parsedBody.data);
      res.status(201).json(plan);
    } catch (error) {
      console.error("Error creating internet plan:", error);
      res.status(500).json({ message: "Failed to create internet plan" });
    }
  });

  app.put("/api/internet-plans/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }
      
      // Validate update data - partial validation for updates
      const parsedBody = insertInternetPlanSchema.partial().safeParse(req.body);
      
      if (!parsedBody.success) {
        return res.status(400).json({ 
          message: "Invalid internet plan data",
          errors: parsedBody.error.format() 
        });
      }
      
      // Check if plan exists
      const existingPlan = await storage.getInternetPlan(id);
      if (!existingPlan) {
        return res.status(404).json({ message: "Internet plan not found" });
      }
      
      // If name is being updated, check it's not a duplicate
      if (parsedBody.data.name && parsedBody.data.name !== existingPlan.name) {
        const planWithSameName = await storage.getInternetPlanByName(parsedBody.data.name);
        if (planWithSameName && planWithSameName.id !== id) {
          return res.status(409).json({ message: "An internet plan with this name already exists" });
        }
      }
      
      const updatedPlan = await storage.updateInternetPlan(id, parsedBody.data);
      res.json(updatedPlan);
    } catch (error) {
      console.error("Error updating internet plan:", error);
      res.status(500).json({ message: "Failed to update internet plan" });
    }
  });

  app.delete("/api/internet-plans/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }
      
      // Check if plan exists
      const existingPlan = await storage.getInternetPlan(id);
      if (!existingPlan) {
        return res.status(404).json({ message: "Internet plan not found" });
      }
      
      await storage.deleteInternetPlan(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting internet plan:", error);
      res.status(500).json({ message: "Failed to delete internet plan" });
    }
  });

  return httpServer;
}
