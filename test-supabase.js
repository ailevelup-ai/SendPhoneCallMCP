require('dotenv').config();
const { supabaseAdmin } = require('./config/supabase');

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Try to select from users table
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Connection successful!');
      console.log('Data:', data);
    }
  } catch (error) {
    console.error('Connection error:', error);
  }
}

testConnection(); 