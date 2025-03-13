require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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
    console.log('Setting up database tables directly...');

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
        console.log(`Executing: ${statement.slice(0, 50)}...`);
        
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          console.error(`Error executing statement:`, error);
          console.log('Attempting to execute with query...');
          
          // Try with query as fallback
          const { error: queryError } = await supabase.query(statement);
          
          if (queryError) {
            console.error(`Query also failed:`, queryError);
          } else {
            console.log('Query succeeded');
          }
        } else {
          console.log('Statement executed successfully');
        }
      } catch (stmtError) {
        console.error(`Error executing statement: ${stmtError.message}`);
      }
    }

    console.log('Direct database setup completed');
  } catch (error) {
    console.error('Error setting up database:', error);
  }
}

// Create user_settings table directly
async function createUserSettingsTable() {
  try {
    console.log('Creating user_settings table...');
    
    const { error } = await supabase
      .from('user_settings')
      .upsert([
        {
          user_id: 'dev-user-id',
          default_voice: 'alloy',
          default_model: 'gpt-4',
          default_temperature: 0.7,
          default_from_number: '+15551234567',
          default_voicemail_action: 'leave_message'
        }
      ]);
    
    if (error) {
      if (error.code === '42P01') { // relation does not exist
        console.log('Creating user_settings table structure...');
        const { error: createError } = await supabase.query(`
          CREATE TABLE IF NOT EXISTS public.user_settings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            default_voice TEXT,
            default_model TEXT,
            default_temperature NUMERIC CHECK (default_temperature >= 0 AND default_temperature <= 1),
            default_from_number TEXT,
            default_voicemail_action TEXT CHECK (default_voicemail_action IN ('leave_message', 'hang_up', 'retry_later')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
          );
        `);
        
        if (createError) {
          console.error('Error creating user_settings table:', createError);
        } else {
          console.log('user_settings table created successfully');
          
          // Try the upsert again
          const { error: retryError } = await supabase
            .from('user_settings')
            .upsert([
              {
                user_id: 'dev-user-id',
                default_voice: 'alloy',
                default_model: 'gpt-4',
                default_temperature: 0.7,
                default_from_number: '+15551234567',
                default_voicemail_action: 'leave_message'
              }
            ]);
            
          if (retryError) {
            console.error('Error inserting initial user settings:', retryError);
          } else {
            console.log('Initial user settings created successfully');
          }
        }
      } else {
        console.error('Error with user_settings table:', error);
      }
    } else {
      console.log('user_settings table verified');
    }
  } catch (error) {
    console.error('Error in createUserSettingsTable:', error);
  }
}

// Create call_history table directly
async function createCallHistoryTable() {
  try {
    console.log('Creating call_history table...');
    
    const { error } = await supabase
      .from('call_history')
      .select('id')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') { // relation does not exist
        console.log('Creating call_history table structure...');
        const { error: createError } = await supabase.query(`
          CREATE TABLE IF NOT EXISTS public.call_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            to_number TEXT NOT NULL,
            from_number TEXT NOT NULL,
            voice_id TEXT,
            model_id TEXT,
            temperature NUMERIC,
            status TEXT,
            duration INTEGER,
            cost NUMERIC,
            transcript TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
          );
        `);
        
        if (createError) {
          console.error('Error creating call_history table:', createError);
        } else {
          console.log('call_history table created successfully');
        }
      } else {
        console.error('Error with call_history table:', error);
      }
    } else {
      console.log('call_history table verified');
    }
  } catch (error) {
    console.error('Error in createCallHistoryTable:', error);
  }
}

// Create credits table directly
async function createCreditsTable() {
  try {
    console.log('Creating credits table...');
    
    const { error } = await supabase
      .from('credits')
      .upsert([
        {
          user_id: 'dev-user-id',
          balance: 100,
          total_added: 100,
          total_used: 0
        }
      ]);
    
    if (error) {
      if (error.code === '42P01') { // relation does not exist
        console.log('Creating credits table structure...');
        const { error: createError } = await supabase.query(`
          CREATE TABLE IF NOT EXISTS public.credits (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            balance NUMERIC NOT NULL DEFAULT 0,
            total_added NUMERIC NOT NULL DEFAULT 0,
            total_used NUMERIC NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            CONSTRAINT credits_user_id_unique UNIQUE (user_id)
          );
        `);
        
        if (createError) {
          console.error('Error creating credits table:', createError);
        } else {
          console.log('credits table created successfully');
          
          // Try the upsert again
          const { error: retryError } = await supabase
            .from('credits')
            .upsert([
              {
                user_id: 'dev-user-id',
                balance: 100,
                total_added: 100,
                total_used: 0
              }
            ]);
            
          if (retryError) {
            console.error('Error inserting initial credits:', retryError);
          } else {
            console.log('Initial credits created successfully');
          }
        }
      } else {
        console.error('Error with credits table:', error);
      }
    } else {
      console.log('credits table verified');
    }
  } catch (error) {
    console.error('Error in createCreditsTable:', error);
  }
}

// Run the direct table creation
async function run() {
  try {
    // Uncomment to use the SQL file approach
    // await setupDatabase();
    
    // Direct table creation
    await createUserSettingsTable();
    await createCallHistoryTable();
    await createCreditsTable();
    
    console.log('Database setup completed');
  } catch (error) {
    console.error('Error in database setup:', error);
  }
}

// Run the setup
run(); 