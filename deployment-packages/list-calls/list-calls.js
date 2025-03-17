/**
 * Lambda function to retrieve a list of all calls
 */

const { createClient } = require('@supabase/supabase-js');
const { buildResponse } = require('./lib/api-response');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Lambda handler to list all calls
 */
exports.handler = async (event) => {
  try {
    console.log('Listing all calls');
    
    // Extract query parameters for filtering/pagination
    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit) || 100;
    const status = queryParams.status;
    
    // Build the query
    let query = supabase
      .from('phone_calls')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(limit);
    
    // Add status filter if provided
    if (status) {
      query = query.eq('status', status);
    }
    
    // Execute the query
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching calls:', error);
      return buildResponse(500, { message: 'Error retrieving calls' });
    }
    
    // Return the list of calls
    return buildResponse(200, data || []);
  } catch (error) {
    console.error('Error in list-calls:', error);
    return buildResponse(500, { message: 'Error retrieving calls' });
  }
}; 