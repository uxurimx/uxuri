import { pgTable, text, timestamp, uuid, pgEnum, unique } from 'drizzle-orm/pg-core'
import { users } from './users'
import { mobileConversations } from './mobile-conversations'

export const memberRoleEnum = pgEnum('member_role', ['owner', 'admin', 'member'])

export const mobileConversationMembers = pgTable(
  'mobile_conversation_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id').notNull().references(() => mobileConversations.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: memberRoleEnum('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),
    mutedUntil: timestamp('muted_until', { withTimezone: true }),
  },
  (t) => [unique().on(t.conversationId, t.userId)]
)
