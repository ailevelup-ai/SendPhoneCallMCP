const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Please check your .env file.');
}

// Create Supabase client with service key for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Create Supabase client with anon key for public operations
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initialize database schema
async function initializeDatabase() {
  try {
    // Create tables using raw SQL
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        -- Enable UUID extension
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        -- Create users table
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          api_key TEXT UNIQUE,
          role TEXT DEFAULT 'user',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create calls table
        CREATE TABLE IF NOT EXISTS calls (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(id),
          phone_number TEXT NOT NULL,
          status TEXT NOT NULL,
          duration INTEGER,
          credits_used DECIMAL,
          task TEXT,
          voice TEXT,
          from_number TEXT,
          recording_url TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create credits table
        CREATE TABLE IF NOT EXISTS credits (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(id),
          balance DECIMAL NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create audit_logs table
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(id),
          event_type TEXT NOT NULL,
          metadata JSONB,
          severity TEXT DEFAULT 'info',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });

    if (error) {
      console.error('Error creating tables:', error);
      throw error;
    }

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
}

module.exports = {
  supabase,
  supabaseAdmin,
  initializeDatabase
}; 