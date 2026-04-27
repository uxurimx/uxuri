import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  boolean,
  numeric,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const shoppingListStatusEnum = pgEnum("shopping_list_status", [
  "active",
  "done",
  "archived",
]);

export const shoppingItemCategoryEnum = pgEnum("shopping_item_category", [
  "frutas_verduras",
  "carnes_mariscos",
  "lacteos_huevos",
  "panaderia",
  "bebidas",
  "abarrotes",
  "limpieza",
  "higiene",
  "congelados",
  "farmacia",
  "otro",
]);

export const shoppingLists = pgTable("shopping_lists", {
  id:         uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  userId:     varchar("user_id", { length: 255 }).references(() => users.id).notNull(),
  businessId: uuid("business_id"),          // null = personal; uuid = negocio compartido
  name:       varchar("name", { length: 200 }).notNull(),
  weekStart:  date("week_start"),            // opcional: liga al plan de comidas
  status:     shoppingListStatusEnum("status").default("active").notNull(),
  notes:      text("notes"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
});

export const shoppingItems = pgTable("shopping_items", {
  id:             uuid("id").primaryKey().defaultRandom(),
  listId:         uuid("list_id").references(() => shoppingLists.id, { onDelete: "cascade" }).notNull(),
  name:           varchar("name", { length: 200 }).notNull(),
  category:       shoppingItemCategoryEnum("category").default("otro").notNull(),
  quantity:       varchar("quantity", { length: 50 }),   // "2 kg", "1 litro", "3 pzas"
  estimatedPrice: numeric("estimated_price", { precision: 10, scale: 2 }),
  notes:          text("notes"),
  isDone:         boolean("is_done").default(false).notNull(),
  sortOrder:      integer("sort_order").default(0).notNull(),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
});

export type ShoppingList = typeof shoppingLists.$inferSelect;
export type ShoppingItem = typeof shoppingItems.$inferSelect;
