/**
 * Check the status of a Bland.AI phone call
 */

require('dotenv').config();
const axios = require('axios');

// Call ID from the previous API call
const CALL_ID = '2a5fda35-d946-4876-a620-8451d9281a64';

// Check call status
async function checkCallStatus() {
  try {
    console.log(`Checking status of call ${CALL_ID}...`);
    
    const response = await axios.get(`https://api.bland.ai/v1/calls/${CALL_ID}`, {
      headers: {
        'Authorization': `Bearer ${process.env.AILEVELUP_ENTERPRISE_API_KEY}`
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
    
    return response.data;
  } catch (error) {
    console.error('Error checking call status:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      console.error('Response status:', error.response.status);
    }
    return { error: error.message };
  }
}

// Execute the function
checkCallStatus()
  .catch(error => {
    console.error('Error:', error);
  }); 