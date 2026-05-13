import { pgTable, text, timestamp, uuid, pgEnum, integer } from 'drizzle-orm/pg-core'
import { users } from './users'
import { mobileConversations } from './mobile-conversations'

export const messageTypeEnum = pgEnum('message_type', ['text', 'image', 'file', 'system'])

export const mobileMessages = pgTable('mobile_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => mobileConversations.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  type: messageTypeEnum('type').notNull().default('text'),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  fileMime: text('file_mime'),
  fileSize: integer('file_size'),
  replyToId: uuid('reply_to_id'),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
