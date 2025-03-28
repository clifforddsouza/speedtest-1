import { 
  users, type User, type InsertUser, 
  speedTests, type SpeedTest, type InsertSpeedTest, 
  internetPlans, type InternetPlan, type InsertInternetPlan, 
  UserRole 
} from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
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
  createSpeedTestsBatch(tests: InsertSpeedTest[]): Promise<SpeedTest[]>; // Batch insert
  getSpeedTests(options?: { limit?: number; offset?: number }): Promise<SpeedTest[]>;
  getSpeedTestsCount(): Promise<number>;
  getSpeedTestsByCustomerId(customerId: string, options?: { limit?: number; offset?: number }): Promise<SpeedTest[]>;
  getSpeedTestsCountByCustomerId(customerId: string): Promise<number>;
  getSpeedTest(id: number): Promise<SpeedTest | undefined>;
  
  // Internet plan operations
  getInternetPlans(): Promise<InternetPlan[]>;
  getInternetPlan(id: number): Promise<InternetPlan | undefined>;
  getInternetPlanByName(name: string): Promise<InternetPlan | undefined>;
  createInternetPlan(plan: InsertInternetPlan): Promise<InternetPlan>;
  updateInternetPlan(id: number, updates: Partial<InternetPlan>): Promise<InternetPlan>;
  deleteInternetPlan(id: number): Promise<void>;
  
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
  
  async createSpeedTestsBatch(insertTests: InsertSpeedTest[]): Promise<SpeedTest[]> {
    if (insertTests.length === 0) return [];
    
    // Process the batch of tests
    const now = new Date();
    const processedTests = insertTests.map(test => ({
      ...test,
      // Ensure packet loss is a number
      packetLoss: typeof test.packetLoss === 'number' 
        ? test.packetLoss 
        : parseFloat(String(test.packetLoss)),
      timestamp: now
    }));
    
    // Insert all tests in a single database operation
    const tests = await db.insert(speedTests)
      .values(processedTests)
      .returning();
      
    return tests;
  }

  async getSpeedTests(options?: { limit?: number; offset?: number }): Promise<SpeedTest[]> {
    // Build SQL query with manual limit and offset
    let query = sql`SELECT * FROM ${speedTests} ORDER BY timestamp DESC`;
    
    if (options?.limit && options?.offset) {
      query = sql`${query} LIMIT ${options.limit} OFFSET ${options.offset}`;
    } else if (options?.limit) {
      query = sql`${query} LIMIT ${options.limit}`;
    } else if (options?.offset) {
      query = sql`${query} OFFSET ${options.offset}`;
    }
    
    const result = await db.execute(query);
    return result.rows as SpeedTest[];
  }
  
  async getSpeedTestsCount(): Promise<number> {
    const result = await db.execute(sql`SELECT COUNT(*) as count FROM ${speedTests}`);
    return Number(result.rows[0]?.count || 0);
  }

  async getSpeedTestsByCustomerId(customerId: string, options?: { limit?: number; offset?: number }): Promise<SpeedTest[]> {
    // Build SQL query with manual limit and offset for customer ID filtering
    let query = sql`SELECT * FROM ${speedTests} WHERE customer_id = ${customerId} ORDER BY timestamp DESC`;
    
    if (options?.limit && options?.offset) {
      query = sql`${query} LIMIT ${options.limit} OFFSET ${options.offset}`;
    } else if (options?.limit) {
      query = sql`${query} LIMIT ${options.limit}`;
    } else if (options?.offset) {
      query = sql`${query} OFFSET ${options.offset}`;
    }
    
    const result = await db.execute(query);
    return result.rows as SpeedTest[];
  }
  
  async getSpeedTestsCountByCustomerId(customerId: string): Promise<number> {
    const result = await db.execute(
      sql`SELECT COUNT(*) as count FROM ${speedTests} WHERE customer_id = ${customerId}`
    );
    return Number(result.rows[0]?.count || 0);
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

  // Internet Plan operations
  async getInternetPlans(): Promise<InternetPlan[]> {
    return db.select().from(internetPlans).orderBy(internetPlans.name);
  }

  async getInternetPlan(id: number): Promise<InternetPlan | undefined> {
    const [plan] = await db.select().from(internetPlans).where(eq(internetPlans.id, id));
    return plan;
  }

  async getInternetPlanByName(name: string): Promise<InternetPlan | undefined> {
    const [plan] = await db.select().from(internetPlans).where(eq(internetPlans.name, name));
    return plan;
  }

  async createInternetPlan(insertPlan: InsertInternetPlan): Promise<InternetPlan> {
    // Make sure downloadSpeed and uploadSpeed are numbers
    const downloadSpeed = typeof insertPlan.downloadSpeed === 'number'
      ? insertPlan.downloadSpeed
      : parseFloat(String(insertPlan.downloadSpeed));
    
    const uploadSpeed = typeof insertPlan.uploadSpeed === 'number'
      ? insertPlan.uploadSpeed
      : parseFloat(String(insertPlan.uploadSpeed));

    const [plan] = await db.insert(internetPlans)
      .values({
        ...insertPlan,
        downloadSpeed,
        uploadSpeed,
        isActive: insertPlan.isActive ?? true,
        createdAt: new Date()
      })
      .returning();
      
    return plan;
  }

  async updateInternetPlan(id: number, updates: Partial<InternetPlan>): Promise<InternetPlan> {
    // Process numeric fields if present
    if (updates.downloadSpeed !== undefined && typeof updates.downloadSpeed !== 'number') {
      updates.downloadSpeed = parseFloat(String(updates.downloadSpeed));
    }
    
    if (updates.uploadSpeed !== undefined && typeof updates.uploadSpeed !== 'number') {
      updates.uploadSpeed = parseFloat(String(updates.uploadSpeed));
    }
    
    const [plan] = await db
      .update(internetPlans)
      .set(updates)
      .where(eq(internetPlans.id, id))
      .returning();
      
    if (!plan) {
      throw new Error(`Internet plan with ID ${id} not found`);
    }
    
    return plan;
  }

  async deleteInternetPlan(id: number): Promise<void> {
    const result = await db
      .delete(internetPlans)
      .where(eq(internetPlans.id, id))
      .returning({ id: internetPlans.id });
      
    if (result.length === 0) {
      throw new Error(`Internet plan with ID ${id} not found`);
    }
  }
}

// Export a singleton instance of the database storage
export const storage = new DatabaseStorage();
