import { neon } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL!)

async function run() {
  console.log('🚀 Migrando tablas mobile...')

  await sql`
    DO $$ BEGIN
      CREATE TYPE conversation_type AS ENUM ('dm', 'group');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `

  await sql`
    DO $$ BEGIN
      CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `

  await sql`
    DO $$ BEGIN
      CREATE TYPE message_type AS ENUM ('text', 'image', 'file', 'system');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `

  await sql`
    DO $$ BEGIN
      CREATE TYPE contact_status AS ENUM ('pending', 'accepted', 'blocked');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `

  await sql`
    CREATE TABLE IF NOT EXISTS mobile_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      push_token TEXT,
      last_seen_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `

  await sql`
    CREATE TABLE IF NOT EXISTS mobile_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type conversation_type NOT NULL,
      name TEXT,
      avatar_url TEXT,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `

  await sql`
    CREATE TABLE IF NOT EXISTS mobile_conversation_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES mobile_conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role member_role NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_read_at TIMESTAMPTZ,
      muted_until TIMESTAMPTZ,
      UNIQUE(conversation_id, user_id)
    );
  `

  await sql`
    CREATE TABLE IF NOT EXISTS mobile_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES mobile_conversations(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      type message_type NOT NULL DEFAULT 'text',
      file_url TEXT,
      file_name TEXT,
      file_mime TEXT,
      file_size INTEGER,
      reply_to_id UUID,
      edited_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `

  await sql`
    CREATE TABLE IF NOT EXISTS mobile_contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status contact_status NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, contact_id)
    );
  `

  await sql`
    CREATE TABLE IF NOT EXISTS mobile_invite_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token TEXT NOT NULL UNIQUE,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      used_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `

  // Indices para performance
  await sql`CREATE INDEX IF NOT EXISTS idx_mobile_messages_conv_created ON mobile_messages(conversation_id, created_at DESC);`
  await sql`CREATE INDEX IF NOT EXISTS idx_mobile_conv_members_user ON mobile_conversation_members(user_id);`
  await sql`CREATE INDEX IF NOT EXISTS idx_mobile_contacts_user ON mobile_contacts(user_id, status);`

  console.log('✅ Tablas mobile creadas exitosamente')
}

run().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
