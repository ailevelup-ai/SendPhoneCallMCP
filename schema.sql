-- Schema for Bland.AI MCP Wrapper

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

-- Create calls table with updated columns
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  call_id TEXT, -- Bland.AI call ID
  phone_number TEXT NOT NULL,
  status TEXT NOT NULL,
  duration INTEGER,
  credits_used DECIMAL,
  task TEXT,
  voice TEXT,
  from_number TEXT,
  model TEXT,
  temperature DECIMAL,
  voicemail_action TEXT,
  answered_by_enabled BOOLEAN DEFAULT FALSE, -- Added missing column
  max_duration INTEGER, -- Added missing column
  answered_by TEXT,
  call_ended_by TEXT,
  transfer_number TEXT,
  recording_url TEXT,
  concatenated_transcript TEXT,
  call_summary TEXT,
  error_message TEXT,
  analysis JSONB,
  analysis_schema JSONB,
  update_status TEXT DEFAULT 'Pending',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
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

-- Create payments table for credit top-ups
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  amount DECIMAL NOT NULL,
  credits_added DECIMAL NOT NULL,
  payment_method TEXT,
  payment_id TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create API usage table
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  endpoint TEXT NOT NULL,
  status_code INTEGER,
  response_time INTEGER, -- in milliseconds
  credits_used DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
); 