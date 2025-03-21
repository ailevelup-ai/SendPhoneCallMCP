const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file');
  process.exit(1);
}

// Create Supabase client with service key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const setupVoices = async () => {
  try {
    console.log('Checking Supabase connection...');
    
    // Test connection to Supabase
    try {
      const { data, error } = await supabase.from('voices').select('*', { count: 'exact' }).limit(1);
      
      if (error) {
        console.error('Error connecting to Supabase or voices table does not exist:', error.message);
        
        // If the error indicates the table doesn't exist, create it
        if (error.code === '42P01') {
          console.log('Trying to create the voices table...');
          
          // Execute raw SQL to create the table
          const { error: createError } = await supabase.sql(`
            CREATE TABLE IF NOT EXISTS public.voices (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL,
              voice_id TEXT NOT NULL,
              provider TEXT DEFAULT 'bland',
              is_default BOOLEAN DEFAULT false,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
              description TEXT,
              language TEXT DEFAULT 'en-US',
              gender TEXT
            );
          `);
          
          if (createError) {
            console.error('Failed to create voices table:', createError.message);
            return false;
          }
          
          console.log('Voices table created successfully');
        } else {
          return false;
        }
      } else {
        console.log('Successfully connected to Supabase');
        const count = await supabase.from('voices').select('*', { count: 'exact' });
        console.log(`Found ${count.count || 0} existing voices`);
        
        // If we have voices already, check if we want to clear them
        if (count.count > 0) {
          // By default, we won't clear existing voices
          const shouldClearVoices = process.argv.includes('--clear');
          
          if (shouldClearVoices) {
            console.log('Clearing existing voices...');
            const { error: clearError } = await supabase.from('voices').delete().neq('id', 0);
            
            if (clearError) {
              console.error('Error clearing existing voices:', clearError.message);
              return false;
            }
            
            console.log('Existing voices cleared successfully');
          } else {
            console.log('Keeping existing voices. Use --clear flag to remove them.');
            return true;
          }
        }
      }
    } catch (error) {
      console.error('Error checking Supabase connection:', error.message);
      // If there's an error connecting to Supabase, we'll use mock data
      console.log('Will use mock voices');
    }
    
    // Skip the Bland API integration for now and use our own mock voices
    console.log('Using pre-defined Bland voices...');
    return populateMockVoices();
  } catch (error) {
    console.error('Unexpected error in setupVoices:', error.message);
    return false;
  }
};

const populateMockVoices = async () => {
  try {
    // Voice data to insert - using actual Bland.ai voice IDs
    const mockVoices = [
      {
        name: 'Alloy',
        voice_id: 'd9c372fd-31db-4c74-ac5a-d194e8e923a4',
        provider: 'bland',
        is_default: true,
        description: 'Clear, neutral American voice',
        language: 'en-US',
        gender: 'neutral'
      },
      {
        name: 'Shimmer',
        voice_id: '4a5c3c9b-19bc-4ae7-9d58-a96950e97ef5',
        provider: 'bland',
        is_default: false,
        description: 'Gentle, feminine American voice',
        language: 'en-US',
        gender: 'female'
      },
      {
        name: 'Nova',
        voice_id: 'c9226079-edd4-49a2-be0a-6f8ffe2f11e7',
        provider: 'bland',
        is_default: false,
        description: 'Feminine American voice with high clarity',
        language: 'en-US',
        gender: 'female'
      },
      {
        name: 'Echo',
        voice_id: '6418de41-12be-485b-ab26-40e7142ab7cb',
        provider: 'bland',
        is_default: false,
        description: 'Masculine American voice',
        language: 'en-US',
        gender: 'male'
      }
    ];
    
    // Insert voice data
    const { error: insertError } = await supabase.from('voices').insert(mockVoices);
    
    if (insertError) {
      console.error('Error inserting mock voice data:', insertError.message);
      return false;
    }
    
    console.log(`Successfully added ${mockVoices.length} mock voices to the database`);
    return true;
  } catch (error) {
    console.error('Error populating voices table with mock data:', error.message);
    return false;
  }
};

// Run the setup
setupVoices()
  .then(success => {
    if (success) {
      console.log('Voice setup completed successfully!');
      
      // List all voices to verify
      return supabase.from('voices').select('*');
    } else {
      console.error('Voice setup failed');
      process.exit(1);
    }
  })
  .then(({ data, error }) => {
    if (error) {
      console.error('Error listing voices:', error.message);
    } else {
      console.log('Current voices in the database:');
      console.table(data);
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Unhandled error during setup:', error.message);
    process.exit(1);
  }); 