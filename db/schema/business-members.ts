import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { businesses } from "./businesses";

export const businessMemberRoleEnum = pgEnum("business_member_role", [
  "owner",
  "partner",
  "viewer",
]);

export const businessMembers = pgTable(
  "business_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .references(() => businesses.id, { onDelete: "cascade" })
      .notNull(),
    userId: varchar("user_id", { length: 255 })
      .references(() => users.id)
      .notNull(),
    role: businessMemberRoleEnum("role").default("viewer").notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("business_member_unique").on(table.businessId, table.userId),
  ]
);

export type BusinessMember = typeof businessMembers.$inferSelect;
