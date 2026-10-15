// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, real, index, primaryKey } from "drizzle-orm/sqlite-core";
export const bills = sqliteTable("bills", {
  id: text("id").primaryKey(),
  payload: text("payload").notNull(),
  version: integer("version").notNull(),
  updatedAt: text("updated_at").notNull(),
  ownerId: text("owner_id").notNull().default("existing-book"),
}, table => [index("idx_bills_owner_updated").on(table.ownerId, table.updatedAt)]);
export const dailyPrices = sqliteTable("daily_prices", {
  date: text("date").primaryKey(),
  jasmineRate: real("jasmine_rate").notNull(),
  pinkRate: real("pink_rate").notNull(),
  createdAt: text("created_at").notNull(),
});
export const owners = sqliteTable("owners", {
  id: text("id").primaryKey(),
  ownerName: text("owner_name").notNull(),
  phone: text("phone").notNull().unique(),
  accountType: text("account_type").notNull().default("business"),
  companyName: text("company_name").notNull().default(""),
  location: text("location").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  mpinHash: text("mpin_hash"),
  recoveryHash: text("recovery_hash").notNull(),
  authVersion: integer("auth_version").notNull().default(1),
  googleSheetUrl: text("google_sheet_url").notNull().default(""),
  createdAt: text("created_at").notNull(),
});
export const ownerSessions = sqliteTable("owner_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => owners.id),
  authVersion: integer("auth_version").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, table => [index("idx_owner_sessions_owner").on(table.ownerId)]);
export const authThrottle = sqliteTable("auth_throttle", {
  key: text("key").primaryKey(),
  hits: integer("hits").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const bookDailyPrices = sqliteTable("book_daily_prices", {
  ownerId: text("owner_id").notNull().references(() => owners.id),
  date: text("date").notNull(),
  jasmineRate: real("jasmine_rate").notNull(),
  pinkRate: real("pink_rate").notNull(),
  createdAt: text("created_at").notNull(),
}, table => [primaryKey({ columns: [table.ownerId, table.date] })]);

export const billAccess = sqliteTable("bill_access", {
  billId: text("bill_id").primaryKey().references(() => bills.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull().references(() => owners.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  recipientHash: text("recipient_hash").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: text("revoked_at"),
});
export const billCorrections = sqliteTable("bill_corrections", {
  id: text("id").primaryKey(),
  billId: text("bill_id").notNull().references(() => bills.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull().references(() => owners.id, { onDelete: "cascade" }),
  accessHash: text("access_hash").notNull(),
  billVersion: integer("bill_version").notNull(),
  dayIndex: integer("day_index"),
  category: text("category").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"),
  reply: text("reply").notNull().default(""),
  createdAt: text("created_at").notNull(),
  reviewedAt: text("reviewed_at"),
}, table => [
  index("idx_bill_corrections_owner_status_created").on(table.ownerId, table.status, table.createdAt),
  index("idx_bill_corrections_access_created").on(table.accessHash, table.createdAt),
]);

export const subscriptions = sqliteTable("subscriptions", {
  identity: text("identity").primaryKey(),
  trialEndsAt: integer("trial_ends_at").notNull(),
  suspended: integer("suspended").notNull().default(0),
  accessUntil: integer("access_until"),
});
export const subscriptionOrders = sqliteTable("subscription_orders", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  identity: text("identity").notNull(),
  accountType: text("account_type").notNull(),
  months: integer("months").notNull(),
  amount: integer("amount").notNull(),
  mode: text("mode").notNull(),
  createdAt: integer("created_at").notNull(),
  paidAt: integer("paid_at"),
  coverageFrom: integer("coverage_from"),
  reference: text("reference").unique(),
  reviewStatus: text("review_status").notNull().default("pending"),
  reviewedAt: integer("reviewed_at"),
}, t => [index("idx_subscription_orders_identity_paid").on(t.identity,t.paidAt),index("idx_subscription_orders_owner_created").on(t.ownerId,t.createdAt)]);

export const siteSettings = sqliteTable("site_settings", {key:text("key").primaryKey(),value:text("value").notNull()});
