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

async function main() {
  try {
    console.log('Checking if voices table exists...');
    // First, try to query the table to see if it exists
    const { error: checkError } = await supabase.from('voices').select('id').limit(1);
    
    if (checkError && checkError.code === '42P01') {
      console.log('Table does not exist, creating it...');
      // Create the table
      const { error: createError } = await supabase.sql(`
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
      
      if (createError) {
        console.error('Failed to create table:', createError);
        process.exit(1);
      }
      
      console.log('Table created successfully');
      
      // Define voice data
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
      
      // Insert data
      const { error: insertError } = await supabase.from('voices').insert(voices);
      
      if (insertError) {
        console.error('Failed to insert voice data:', insertError);
        process.exit(1);
      }
      
      console.log(`Successfully added ${voices.length} voices to the table`);
    } else if (checkError) {
      console.error('Error checking for voices table:', checkError);
      process.exit(1);
    } else {
      console.log('Voices table already exists, checking data...');
      
      // Check if table has data
      const { data, error: countError } = await supabase.from('voices').select('*');
      
      if (countError) {
        console.error('Error checking voice data:', countError);
        process.exit(1);
      }
      
      if (data.length === 0) {
        console.log('Table exists but is empty, adding voice data...');
        
        // Define voice data
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
        
        // Insert data
        const { error: insertError } = await supabase.from('voices').insert(voices);
        
        if (insertError) {
          console.error('Failed to insert voice data:', insertError);
          process.exit(1);
        }
        
        console.log(`Successfully added ${voices.length} voices to the table`);
        
        // Fetch data again to verify
        const { data: updatedData, error: updatedError } = await supabase.from('voices').select('*');
        if (!updatedError) {
          console.log(`Now have ${updatedData.length} voices in the database`);
          console.table(updatedData);
        }
      } else {
        console.log(`Found ${data.length} voices in the database`);
        console.table(data);
      }
    }
  } catch (error) {
    console.error('Unhandled error:', error);
    process.exit(1);
  }
}

main(); 