import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import crypto from 'crypto';

// Speed test endpoints for high bandwidth testing
app.get('/api/speedtest/download', (req, res) => {
  const size = parseInt(req.query.size as string) || 25 * 1024 * 1024; // 25MB chunks
  const buffer = crypto.randomBytes(size);
  res.send(buffer);
});

app.post('/api/speedtest/upload', express.raw({limit: '50mb', type: '*/*'}), (req, res) => {
  res.sendStatus(200);
});
import { insertSpeedTestSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
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
      const parsedBody = insertSpeedTestSchema.safeParse(req.body);
      
      if (!parsedBody.success) {
        return res.status(400).json({ 
          message: "Invalid speed test data",
          errors: parsedBody.error.format() 
        });
      }
      
      const speedTest = await storage.createSpeedTest(parsedBody.data);
      res.status(201).json(speedTest);
    } catch (error) {
      console.error("Error creating speed test:", error);
      res.status(500).json({ message: "Failed to save speed test data" });
    }
  });

  // Packet loss measurement endpoint
  app.post("/api/measure-packet-loss", async (req, res) => {
    try {
      // Validate request body
      const schema = z.object({
        packetCount: z.number().int().positive(),
      });
      
      const parsedBody = schema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: parsedBody.error.format() 
        });
      }
      
      const { packetCount } = parsedBody.data;
      
      // Simulate packet loss (between 0% and 5%)
      // In a real implementation, we would perform actual packet loss measurement here
      const lostPackets = Math.floor(Math.random() * (packetCount * 0.05));
      const packetLossPercentage = (lostPackets / packetCount) * 100;
      
      res.json({
        sentPackets: packetCount,
        receivedPackets: packetCount - lostPackets,
        lostPackets,
        packetLossPercentage: parseFloat(packetLossPercentage.toFixed(2))
      });
    } catch (error) {
      console.error("Error measuring packet loss:", error);
      res.status(500).json({ message: "Failed to measure packet loss" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
