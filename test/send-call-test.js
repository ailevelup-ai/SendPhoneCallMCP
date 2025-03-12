require('dotenv').config();
const axios = require('axios');

/**
 * Test script to send a phone call
 * 
 * This script demonstrates how to use the phone call API
 * to initiate a call using the Bland.AI service.
 */

// Set your authentication token (you would get this from logging in)
const AUTH_TOKEN = 'your_auth_token_here'; // Replace with your actual auth token
const API_URL = `http://localhost:${process.env.PORT || 3000}/api/v1/phone-calls`;

// Phone call data
const callData = {
  phoneNumber: '+1234567890', // Replace with a real phone number
  script: "Hello, this is a test call from the Bland.AI MCP Wrapper. This is just a test, please ignore this call. Thank you and have a nice day.",
  voiceId: 'male-voice-1',
  reduceLatency: true,
  waitForGreeting: true,
  interruptionsEnabled: true,
  metadata: {
    testCall: true,
    purpose: 'API testing'
  }
};

// Function to send the call
async function sendTestCall() {
  try {
    console.log('Sending test phone call...');
    
    const response = await axios.post(`${API_URL}/calls`, callData, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Call sent successfully!');
    console.log('Call ID:', response.data.callId);
    console.log('Status:', response.data.status);
    console.log('Estimated Cost:', response.data.estimatedCost, 'credits');
    
    return response.data.callId;
  } catch (error) {
    console.error('❌ Failed to send call:');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(`Status: ${error.response.status}`);
      console.error('Error data:', error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server. Is the server running?');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error message:', error.message);
    }
  }
}

// Function to check call status
async function checkCallStatus(callId) {
  try {
    console.log(`\nChecking status of call ${callId}...`);
    
    const response = await axios.get(`${API_URL}/calls/${callId}`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });
    
    console.log('✅ Call status retrieved:');
    console.log('Status:', response.data.call.status);
    console.log('Duration:', response.data.call.duration || 'N/A');
    
    return response.data.call;
  } catch (error) {
    console.error('❌ Failed to check call status:');
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Error data:', error.response.data);
    } else if (error.request) {
      console.error('No response received from server');
    } else {
      console.error('Error message:', error.message);
    }
  }
}

// Main function to run the test
async function runTest() {
  try {
    // Send the test call
    const callId = await sendTestCall();
    
    if (!callId) {
      console.error('No call ID received, cannot continue with status check.');
      return;
    }
    
    // Check initial status
    await checkCallStatus(callId);
    
    // Wait a bit and check status again
    console.log('\nWaiting 30 seconds to check status again...');
    setTimeout(async () => {
      await checkCallStatus(callId);
      
      console.log('\nTest completed. You can continue to monitor the call status manually.');
      console.log(`GET ${API_URL}/calls/${callId}`);
    }, 30000);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
runTest(); 