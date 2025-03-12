const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Create Supabase client for server-side operations (with service key)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Create Supabase client for client-side operations (with anon key)
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

module.exports = { 
  supabaseAdmin, 
  supabaseClient 
}; 