import {
  pgTable,
  uuid,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { workspaceMembers } from "./workspace-members";
import { workspaceProfiles } from "./workspace-profiles";

export const workspaceMemberProfiles = pgTable(
  "workspace_member_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .references(() => workspaceMembers.id, { onDelete: "cascade" })
      .notNull(),
    profileId: uuid("profile_id")
      .references(() => workspaceProfiles.id, { onDelete: "cascade" })
      .notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workspace_member_profile_unique").on(table.memberId, table.profileId),
  ]
);

export type WorkspaceMemberProfile = typeof workspaceMemberProfiles.$inferSelect;
export type NewWorkspaceMemberProfile = typeof workspaceMemberProfiles.$inferInsert;
