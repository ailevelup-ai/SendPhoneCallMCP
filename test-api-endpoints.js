/**
 * Simple API Endpoint Tester
 * 
 * This script tests the API Gateway endpoints directly without 
 * relying on unit tests of the Lambda functions.
 */

const fetch = require('node-fetch');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configuration
const API_URL = process.env.API_URL || 'https://ql3w5ogpvb.execute-api.us-east-1.amazonaws.com/dev';
const TEST_PHONE_NUMBER = process.env.TEST_PHONE_NUMBER || '+15555555555';

// Utility to make API requests
async function callApi(method, endpoint, data = null) {
  const url = `${API_URL}${endpoint}`;
  console.log(`\nCalling ${method} ${url}`);
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    const responseData = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log('Response:');
    console.log(JSON.stringify(responseData, null, 2));
    
    return { status: response.status, data: responseData };
  } catch (error) {
    console.error('Error calling API:', error.message);
    return { error: error.message };
  }
}

// Main function to run tests
async function runTests() {
  console.log('API Endpoint Tester');
  console.log('==================');
  console.log(`Testing against API: ${API_URL}`);
  
  // Test 1: Get Models
  console.log('\n= TEST 1: Get Models =');
  await callApi('GET', '/models');
  
  // Test 2: Get Voices
  console.log('\n= TEST 2: Get Voices =');
  await callApi('GET', '/voices');
  
  // Test 3: Create a call
  console.log('\n= TEST 3: Create Call =');
  const callData = {
    toNumber: TEST_PHONE_NUMBER,
    model: 'claude-3-opus-20240229',
    voice: 'alloy',
    temperature: 0.7,
    text: "This is a test call from the API Endpoint Tester"
  };
  
  const callResponse = await callApi('POST', '/call', callData);
  
  if (callResponse.status === 201 && callResponse.data && callResponse.data.callId) {
    const callId = callResponse.data.callId;
    
    // Test 4: Get call details
    console.log(`\n= TEST 4: Get Call Details (ID: ${callId}) =`);
    await callApi('GET', `/call/${callId}`);
    
    // Test 5: List calls
    console.log('\n= TEST 5: List All Calls =');
    await callApi('GET', '/calls');
  } else {
    console.log('\nSkipping tests 4 and 5 because call creation failed');
  }
  
  console.log('\nAPI tests completed');
}

// Run the tests
runTests().catch(error => {
  console.error('Test execution error:', error);
}); 