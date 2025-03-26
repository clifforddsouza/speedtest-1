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

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

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
  notes: text("notes"),
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertSpeedTest = z.infer<typeof insertSpeedTestSchema>;
export type SpeedTest = typeof speedTests.$inferSelect;
