// Script to update the database schema
require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');

async function updateCallsTable() {
  console.log('Updating calls table schema...');
  
  try {
    // Add missing columns to the calls table
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        -- Add missing columns to calls table
        ALTER TABLE calls 
        ADD COLUMN IF NOT EXISTS call_id TEXT,
        ADD COLUMN IF NOT EXISTS model TEXT,
        ADD COLUMN IF NOT EXISTS temperature DECIMAL,
        ADD COLUMN IF NOT EXISTS voicemail_action TEXT,
        ADD COLUMN IF NOT EXISTS answered_by_enabled BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS max_duration INTEGER,
        ADD COLUMN IF NOT EXISTS answered_by TEXT,
        ADD COLUMN IF NOT EXISTS call_ended_by TEXT,
        ADD COLUMN IF NOT EXISTS transfer_number TEXT,
        ADD COLUMN IF NOT EXISTS concatenated_transcript TEXT,
        ADD COLUMN IF NOT EXISTS call_summary TEXT,
        ADD COLUMN IF NOT EXISTS error_message TEXT,
        ADD COLUMN IF NOT EXISTS analysis JSONB,
        ADD COLUMN IF NOT EXISTS analysis_schema JSONB,
        ADD COLUMN IF NOT EXISTS update_status TEXT DEFAULT 'Pending',
        ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW();
      `
    });

    if (error) {
      console.error('Error updating calls table:', error);
      return;
    }

    console.log('Calls table updated successfully!');
    
    // Create payments table if it doesn't exist
    const { error: paymentsError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        -- Create payments table for credit top-ups if it doesn't exist
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

        -- Create API usage table if it doesn't exist
        CREATE TABLE IF NOT EXISTS api_usage (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(id),
          endpoint TEXT NOT NULL,
          status_code INTEGER,
          response_time INTEGER, -- in milliseconds
          credits_used DECIMAL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });

    if (paymentsError) {
      console.error('Error creating additional tables:', paymentsError);
      return;
    }

    console.log('Additional tables created successfully!');
  } catch (error) {
    console.error('Unexpected error:', error);
  } finally {
    process.exit(0);
  }
}

updateCallsTable(); 