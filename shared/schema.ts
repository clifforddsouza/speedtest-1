import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
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
});

export const insertSpeedTestSchema = createInsertSchema(speedTests).omit({
  id: true,
  timestamp: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertSpeedTest = z.infer<typeof insertSpeedTestSchema>;
export type SpeedTest = typeof speedTests.$inferSelect;
