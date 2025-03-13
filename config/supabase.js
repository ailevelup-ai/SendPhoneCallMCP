const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
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
    // Read schema from SQL file
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Create tables using raw SQL from file
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql: schema });

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