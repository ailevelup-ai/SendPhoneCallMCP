const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with parameters from SSM
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials not found! Check SSM parameters.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

/**
 * Get a user's API key from Supabase
 * @param {string} apiKey - The API key to verify
 * @returns {Promise<Object|null>} - User record or null if not found
 */
async function getUserByApiKey(apiKey) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('api_key', apiKey)
      .single();
    
    if (error) {
      console.error('Error fetching user by API key:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Exception fetching user by API key:', error);
    return null;
  }
}

/**
 * Get a user's credits balance
 * @param {string} userId - The user ID to check
 * @returns {Promise<number>} - Credits balance or 0 if not found
 */
async function getUserCredits(userId) {
  try {
    const { data, error } = await supabase
      .from('credits')
      .select('balance')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching user credits:', error);
      return 0;
    }
    
    return data?.balance || 0;
  } catch (error) {
    console.error('Exception fetching user credits:', error);
    return 0;
  }
}

module.exports = {
  supabase,
  getUserByApiKey,
  getUserCredits
}; 