import { pgTable, text, timestamp, uuid, pgEnum, unique } from 'drizzle-orm/pg-core'
import { users } from './users'

export const contactStatusEnum = pgEnum('contact_status', ['pending', 'accepted', 'blocked'])

export const mobileContacts = pgTable(
  'mobile_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    contactId: text('contact_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: contactStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.contactId)]
)
