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
    
    // Get Bland AI voices to populate the table
    console.log('Fetching voices from Bland AI...');
    
    const apiKey = process.env.AILEVELUP_ENTERPRISE_KEY || process.env.AILEVELUP_API_KEY || process.env.BLAND_API_KEY;
    
    if (!apiKey) {
      console.error('No Bland API key found. Using mock voices instead.');
      return populateMockVoices();
    }
    
    try {
      const axios = require('axios');
      const response = await axios.get('https://api.bland.ai/v1/voices', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      const blandVoices = response.data.voices || [];
      console.log(`Retrieved ${blandVoices.length} voices from Bland AI`);
      
      if (blandVoices.length === 0) {
        console.log('No voices returned from Bland AI. Using mock voices instead.');
        return populateMockVoices();
      }
      
      // Format the Bland voices for our database
      const formattedVoices = blandVoices.map(voice => ({
        name: voice.name.toLowerCase(),
        voice_id: voice.voice_id,
        provider: 'bland',
        is_default: voice.name.toLowerCase() === 'michael', // Set Michael as default
        description: voice.description || `${voice.name} voice`,
        language: voice.accent_origin || 'en-US',
        gender: voice.gender ? voice.gender.toLowerCase() : 'unknown'
      }));
      
      // Insert the voices into the database
      const { error: insertError } = await supabase.from('voices').insert(formattedVoices);
      
      if (insertError) {
        console.error('Error inserting Bland voices:', insertError.message);
        return false;
      }
      
      console.log(`Successfully added ${formattedVoices.length} Bland voices to the database`);
      return true;
    } catch (error) {
      console.error('Error fetching voices from Bland AI:', error.message);
      console.log('Falling back to mock voices');
      return populateMockVoices();
    }
  } catch (error) {
    console.error('Unexpected error in setupVoices:', error.message);
    return false;
  }
};

const populateMockVoices = async () => {
  try {
    // Voice data to insert
    const mockVoices = [
      {
        name: 'michael',
        voice_id: 'bland-michael',
        provider: 'bland',
        is_default: true,
        description: 'Clear and friendly American accent',
        language: 'en-US',
        gender: 'male'
      },
      {
        name: 'emma',
        voice_id: 'bland-emma',
        provider: 'bland',
        is_default: false,
        description: 'Professional female American voice',
        language: 'en-US',
        gender: 'female'
      },
      {
        name: 'james',
        voice_id: 'bland-james',
        provider: 'bland',
        is_default: false,
        description: 'Deep and authoritative British accent',
        language: 'en-GB',
        gender: 'male'
      },
      {
        name: 'olivia',
        voice_id: 'bland-olivia',
        provider: 'bland',
        is_default: false,
        description: 'Sophisticated British accent',
        language: 'en-GB',
        gender: 'female'
      },
      {
        name: 'william',
        voice_id: 'bland-william',
        provider: 'bland',
        is_default: false,
        description: 'Casual Australian accent',
        language: 'en-AU',
        gender: 'male'
      },
      {
        name: 'sophia',
        voice_id: 'bland-sophia',
        provider: 'bland',
        is_default: false,
        description: 'Warm Australian accent',
        language: 'en-AU',
        gender: 'female'
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