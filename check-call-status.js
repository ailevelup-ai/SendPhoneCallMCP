/**
 * Check the status of a Bland.AI phone call
 */

const axios = require('axios');

// Lambda handler function
exports.handler = async (event, context) => {
  try {
    console.log('Event received:', JSON.stringify(event));
    
    // Get call ID from the event
    const callId = event.callId || process.env.DEFAULT_CALL_ID;
    
    if (!callId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Call ID is required' })
      };
    }
    
    console.log(`Checking status of call ${callId}...`);
    
    const apiKey = process.env.AILEVELUP_ENTERPRISE_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'API key is not configured' })
      };
    }
    
    const response = await axios.get(`https://api.bland.ai/v1/calls/${callId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    console.log('Call status response:', JSON.stringify(response.data, null, 2));
    
    // Log the call status in a more user-friendly format
    const callData = response.data;
    console.log('\nCall Status Summary:');
    console.log('-------------------');
    console.log(`Status: ${callData.status}`);
    console.log(`Duration: ${callData.duration || 'N/A'} seconds`);
    console.log(`Started at: ${callData.started_at || 'Not started yet'}`);
    console.log(`Ended at: ${callData.ended_at || 'Not ended yet'}`);
    
    if (callData.transcript) {
      console.log('\nCall Transcript:');
      console.log('---------------');
      const transcript = callData.transcript;
      transcript.forEach(entry => {
        console.log(`${entry.speaker}: ${entry.text}`);
      });
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify(callData)
    };
  } catch (error) {
    console.error('Error checking call status:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      console.error('Response status:', error.response.status);
    }
    
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify({ 
        error: error.message,
        details: error.response?.data || 'No additional details'
      })
    };
  }
}; 