import { pgTable, text, timestamp, uuid, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users'

export const conversationTypeEnum = pgEnum('conversation_type', ['dm', 'group'])

export const mobileConversations = pgTable('mobile_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: conversationTypeEnum('type').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdBy: text('created_by').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
