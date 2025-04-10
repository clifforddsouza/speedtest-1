import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles enum
export const UserRole = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  MANAGER: "manager",
  USER: "user"
} as const;

// Internet plan options
export const InternetPlan = {
  PLAN_10: "10Mbps",
  PLAN_50: "50Mbps",
  PLAN_100: "100Mbps",
  PLAN_250: "250Mbps",
  PLAN_500: "500Mbps",
  PLAN_1000: "1Gbps",
  PLAN_2000: "2Gbps",
  PLAN_5000: "5Gbps",
  PLAN_10000: "10Gbps"
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];
export type InternetPlanType = typeof InternetPlan[keyof typeof InternetPlan];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default(UserRole.USER),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const speedTests = pgTable("speed_tests", {
  id: serial("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  testLocation: text("test_location"),
  internetPlan: text("internet_plan"), // Changed from notes to internetPlan
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  downloadSpeed: real("download_speed").notNull(),
  uploadSpeed: real("upload_speed").notNull(),
  ping: real("ping").notNull(),
  jitter: real("jitter").notNull(),
  packetLoss: real("packet_loss").notNull(),
  isp: text("isp"),
  ipAddress: text("ip_address"),
  server: text("server"),
  distance: text("distance"),
  userAgent: text("user_agent"),
  downloadData: real("download_data"),
  uploadData: real("upload_data"),
  testDuration: real("test_duration"),
  // Adding percentile fields for export report
  downloadPercentile: real("download_percentile"),
  uploadPercentile: real("upload_percentile"),
  // Adding username to track who ran the test
  username: text("username"),
});

export const internetPlans = pgTable("internet_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  downloadSpeed: real("download_speed").notNull(),
  uploadSpeed: real("upload_speed").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
});

export const insertSpeedTestSchema = createInsertSchema(speedTests).omit({
  id: true,
  timestamp: true,
});

export const insertInternetPlanSchema = createInsertSchema(internetPlans).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertSpeedTest = z.infer<typeof insertSpeedTestSchema>;
export type SpeedTest = typeof speedTests.$inferSelect;

export type InsertInternetPlan = z.infer<typeof insertInternetPlanSchema>;
export type InternetPlan = typeof internetPlans.$inferSelect;
