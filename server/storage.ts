import { users, type User, type InsertUser, speedTests, type SpeedTest, type InsertSpeedTest, UserRole } from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { eq, desc } from "drizzle-orm";
import { db, pool } from "./db";

// Storage interface definition
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  
  // Speed test operations
  createSpeedTest(test: InsertSpeedTest): Promise<SpeedTest>;
  getSpeedTests(): Promise<SpeedTest[]>;
  getSpeedTestsByCustomerId(customerId: string): Promise<SpeedTest[]>;
  getSpeedTest(id: number): Promise<SpeedTest | undefined>;
  
  // Session store
  sessionStore: session.Store;
}

// PostgreSQL implementation of the storage interface
const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Set defaults for required fields
    const role = insertUser.role || UserRole.USER;
    const isActive = true;
    const createdAt = new Date();

    const [user] = await db.insert(users)
      .values({
        ...insertUser,
        role,
        isActive,
        createdAt
      })
      .returning();
      
    return user;
  }

  async createSpeedTest(insertTest: InsertSpeedTest): Promise<SpeedTest> {
    // Process packet loss to ensure it's stored as a number
    const packetLoss = typeof insertTest.packetLoss === 'number'
      ? insertTest.packetLoss
      : parseFloat(String(insertTest.packetLoss));

    // Insert the test with current timestamp
    const [test] = await db.insert(speedTests)
      .values({
        ...insertTest,
        packetLoss,
        timestamp: new Date()
      })
      .returning();
      
    return test;
  }

  async getSpeedTests(): Promise<SpeedTest[]> {
    return db.select().from(speedTests).orderBy(desc(speedTests.timestamp));
  }

  async getSpeedTestsByCustomerId(customerId: string): Promise<SpeedTest[]> {
    return db.select()
      .from(speedTests)
      .where(eq(speedTests.customerId, customerId))
      .orderBy(desc(speedTests.timestamp));
  }

  async getSpeedTest(id: number): Promise<SpeedTest | undefined> {
    const [test] = await db.select().from(speedTests).where(eq(speedTests.id, id));
    return test;
  }
  
  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }
  
  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
      
    if (!user) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    return user;
  }
  
  async deleteUser(id: number): Promise<void> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
      
    if (result.length === 0) {
      throw new Error(`User with ID ${id} not found`);
    }
  }
}

// Export a singleton instance of the database storage
export const storage = new DatabaseStorage();
