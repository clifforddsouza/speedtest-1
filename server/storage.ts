import { users, type User, type InsertUser, speedTests, type SpeedTest, type InsertSpeedTest } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Speed test operations
  createSpeedTest(test: InsertSpeedTest): Promise<SpeedTest>;
  getSpeedTests(): Promise<SpeedTest[]>;
  getSpeedTestsByCustomerId(customerId: string): Promise<SpeedTest[]>;
  getSpeedTest(id: number): Promise<SpeedTest | undefined>;
  
  // Session store
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private speedTests: Map<number, SpeedTest>;
  userCurrentId: number;
  speedTestCurrentId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.speedTests = new Map();
    this.userCurrentId = 1;
    this.speedTestCurrentId = 1;
    
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createSpeedTest(insertTest: InsertSpeedTest): Promise<SpeedTest> {
    const id = this.speedTestCurrentId++;
    const timestamp = new Date();
    
    // Ensure testLocation and notes are null if undefined
    const testLocation = insertTest.testLocation ?? null;
    const notes = insertTest.notes ?? null;
    const testDuration = insertTest.testDuration ?? null;
    const isp = insertTest.isp ?? null;
    const ipAddress = insertTest.ipAddress ?? null;
    const server = insertTest.server ?? null;
    const distance = insertTest.distance ?? null;
    const userAgent = insertTest.userAgent ?? null;
    const downloadData = insertTest.downloadData ?? null;
    const uploadData = insertTest.uploadData ?? null;
    
    const test: SpeedTest = { 
      ...insertTest, 
      testLocation,
      notes,
      testDuration,
      isp,
      ipAddress,
      server,
      distance,
      userAgent,
      downloadData,
      uploadData,
      id, 
      timestamp 
    };
    
    this.speedTests.set(id, test);
    return test;
  }

  async getSpeedTests(): Promise<SpeedTest[]> {
    return Array.from(this.speedTests.values()).sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  async getSpeedTestsByCustomerId(customerId: string): Promise<SpeedTest[]> {
    return Array.from(this.speedTests.values())
      .filter(test => test.customerId === customerId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getSpeedTest(id: number): Promise<SpeedTest | undefined> {
    return this.speedTests.get(id);
  }
}

export const storage = new MemStorage();
