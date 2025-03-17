const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file');
  process.exit(1);
}

// Create Supabase client with service key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const createVoicesTable = async () => {
  try {
    // Check if table exists by trying to query it
    const { error: checkError } = await supabase.from('voices').select('count(*)', { count: 'exact' }).limit(1);
    
    if (checkError && checkError.code === '42P01') {
      console.log('Voices table does not exist, creating it...');
      
      // Execute raw SQL to create the table
      const { error } = await supabase.sql(`
        CREATE TABLE public.voices (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          voice_id TEXT NOT NULL,
          provider TEXT DEFAULT '11labs',
          is_default BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          description TEXT,
          language TEXT DEFAULT 'en-US',
          gender TEXT
        );
      `);
      
      if (error) {
        console.error('Error creating voices table:', error);
        return false;
      }
      
      console.log('Voices table created successfully');
    } else if (checkError) {
      console.error('Error checking for voices table:', checkError);
      return false;
    } else {
      console.log('Voices table already exists');
    }
    
    return true;
  } catch (error) {
    console.error('Error creating voices table:', error);
    return false;
  }
};

const populateVoices = async () => {
  try {
    // Check if we already have voices in the table
    const { data, error } = await supabase.from('voices').select('*');
    
    if (error) {
      console.error('Error checking for existing voices:', error);
      return false;
    }
    
    if (data && data.length > 0) {
      console.log(`Table already has ${data.length} voices, skipping population`);
      return true;
    }
    
    // Voice data to insert
    const voices = [
      {
        name: 'michael',
        voice_id: '11labs-michael',
        provider: '11labs',
        is_default: true,
        description: 'English/American male voice',
        language: 'en-US',
        gender: 'male'
      },
      {
        name: 'mike',
        voice_id: '11labs-michael',
        provider: '11labs',
        is_default: false,
        description: 'English/American male voice (alias for michael)',
        language: 'en-US',
        gender: 'male'
      },
      {
        name: 'rachel',
        voice_id: '11labs-rachel',
        provider: '11labs',
        is_default: false,
        description: 'English/American female voice',
        language: 'en-US',
        gender: 'female'
      },
      {
        name: 'dave',
        voice_id: '11labs-dave',
        provider: '11labs',
        is_default: false,
        description: 'English/British male voice',
        language: 'en-GB',
        gender: 'male'
      },
      {
        name: 'clyde',
        voice_id: '11labs-clyde',
        provider: '11labs',
        is_default: false,
        description: 'English/American male voice',
        language: 'en-US',
        gender: 'male'
      },
      {
        name: 'grace',
        voice_id: '11labs-grace',
        provider: '11labs',
        is_default: false,
        description: 'English/American female voice',
        language: 'en-US',
        gender: 'female'
      }
    ];
    
    // Insert voice data
    const { error: insertError } = await supabase.from('voices').insert(voices);
    
    if (insertError) {
      console.error('Error inserting voice data:', insertError);
      return false;
    }
    
    console.log(`Successfully added ${voices.length} voices to the table`);
    return true;
  } catch (error) {
    console.error('Error populating voices table:', error);
    return false;
  }
};

const setup = async () => {
  // Create the table if it doesn't exist
  const tableCreated = await createVoicesTable();
  if (!tableCreated) {
    console.error('Failed to ensure voices table exists');
    process.exit(1);
  }
  
  // Populate with initial data if empty
  const populateSuccess = await populateVoices();
  if (!populateSuccess) {
    console.error('Failed to populate voices table');
    process.exit(1);
  }
  
  console.log('Setup completed successfully!');
  
  // List all voices to verify
  const { data, error } = await supabase.from('voices').select('*');
  if (error) {
    console.error('Error listing voices:', error);
  } else {
    console.log('Current voices in the database:');
    console.table(data);
  }
};

// Run the setup
setup().catch(error => {
  console.error('Unhandled error during setup:', error);
  process.exit(1); 