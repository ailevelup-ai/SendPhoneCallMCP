/**
 * Lambda function to retrieve details of a specific call
 */

const { createClient } = require('@supabase/supabase-js');
const { buildResponse } = require('./lib/api-response');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Lambda handler to get details of a specific call
 */
exports.handler = async (event) => {
  try {
    // Extract call ID from path parameters
    const callId = event.pathParameters?.callId;
    
    if (!callId) {
      return buildResponse(400, { message: 'Missing call ID' });
    }
    
    console.log(`Getting details for call: ${callId}`);
    
    // Fetch call details from database
    const { data, error } = await supabase
      .from('phone_calls')
      .select('*')
      .eq('callId', callId)
      .single();
    
    if (error) {
      console.error('Error fetching call details:', error);
      return buildResponse(500, { message: 'Error retrieving call details' });
    }
    
    if (!data) {
      return buildResponse(404, { message: 'Call not found' });
    }
    
    // Return the call details
    return buildResponse(200, data);
  } catch (error) {
    console.error('Error in get-call-details:', error);
    return buildResponse(500, { message: 'Error retrieving call details' });
  }
}; 