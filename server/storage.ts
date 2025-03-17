import { users, type User, type InsertUser, speedTests, type SpeedTest, type InsertSpeedTest } from "@shared/schema";

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private speedTests: Map<number, SpeedTest>;
  userCurrentId: number;
  speedTestCurrentId: number;

  constructor() {
    this.users = new Map();
    this.speedTests = new Map();
    this.userCurrentId = 1;
    this.speedTestCurrentId = 1;
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
    const test: SpeedTest = { ...insertTest, id, timestamp };
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
