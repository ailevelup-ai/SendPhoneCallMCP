/**
 * Script to check the status of a phone call using the direct API endpoint
 */

const axios = require('axios');

// Get call ID from command line arguments
const callId = process.argv[2];

if (!callId) {
  console.error('Please provide a call ID as a command line argument');
  console.error('Usage: node get-call-status.js <callId>');
  process.exit(1);
}

async function getCallStatus(callId) {
  try {
    console.log(`Checking status for call ID: ${callId}`);
    const response = await axios.get(`http://localhost:3040/api/v1/phone-calls/${callId}`, {
      headers: {
        'Content-Type': 'application/json',
        // Using a dummy development API key
        'X-API-Key': 'dev-key'
      }
    });

    console.log('Call Status:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error checking call status:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      console.error('Response status:', error.response.status);
    }
    return null;
  }
}

// Execute the call status check
getCallStatus(callId); 