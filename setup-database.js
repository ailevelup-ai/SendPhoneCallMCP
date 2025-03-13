require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  try {
    console.log('Setting up database tables...');

    // Create user_settings table
    const { error: userSettingsError } = await supabase.rpc('create_user_settings_table', {});
    if (userSettingsError) {
      console.error('Error creating user_settings table:', userSettingsError);
    } else {
      console.log('user_settings table created successfully');
    }

    // Create call_history table
    const { error: callHistoryError } = await supabase.rpc('create_call_history_table', {});
    if (callHistoryError) {
      console.error('Error creating call_history table:', callHistoryError);
    } else {
      console.log('call_history table created successfully');
    }

    // Create credits table
    const { error: creditsError } = await supabase.rpc('create_credits_table', {});
    if (creditsError) {
      console.error('Error creating credits table:', creditsError);
    } else {
      console.log('credits table created successfully');
    }

    console.log('Database setup completed');
  } catch (error) {
    console.error('Error setting up database:', error);
  }
}

// Run the setup
setupDatabase(); 