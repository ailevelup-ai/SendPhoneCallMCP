require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public'
  }
});

async function setupDatabase() {
  try {
    console.log('Setting up database...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'direct-supabase-setup.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // Execute each statement
    for (const statement of statements) {
      try {
        console.log(`Executing SQL statement...`);
        const { data, error } = await supabase.from('_sql').rpc('exec_sql', { sql: statement });
        
        if (error) {
          console.error('Error executing statement:', error);
          // Try with raw query if exec_sql fails
          const { error: rpcError } = await supabase.rpc('exec_sql', { sql: statement });
          if (rpcError) {
            console.error('RPC also failed:', rpcError);
          } else {
            console.log('Statement executed successfully via RPC');
          }
        } else {
          console.log('Statement executed successfully');
        }
      } catch (stmtError) {
        console.error(`Error executing statement:`, stmtError);
      }
    }
    
    console.log('Database setup completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the setup
setupDatabase(); 