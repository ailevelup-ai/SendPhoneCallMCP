/**
 * Comprehensive API Endpoint Tester
 * 
 * This script tests the API Gateway endpoints in different environments
 * and provides detailed reports on failures and successes.
 */

const fetch = require('node-fetch');
const dotenv = require('dotenv');
const fs = require('fs');

// Command line arguments for environment
const environment = process.argv[2] || 'dev';

// Load environment variables from the appropriate .env file
let envFile = '.env';
if (environment !== 'dev') {
  envFile = `.env.${environment}`;
}

if (fs.existsSync(envFile)) {
  console.log(`Loading environment from ${envFile}`);
  dotenv.config({ path: envFile });
} else {
  console.log(`Warning: ${envFile} not found, using default .env file`);
  dotenv.config();
}

// Configuration
const API_URL = process.env.API_URL || 'https://ql3w5ogpvb.execute-api.us-east-1.amazonaws.com/dev';
const TEST_PHONE_NUMBER = process.env.TEST_PHONE_NUMBER || '+15555555555';
const API_KEY = process.env.API_KEY || '';

// Results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

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
  
  // Add API key if provided
  if (API_KEY) {
    options.headers['x-api-key'] = API_KEY;
  }
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    const responseData = await response.text();
    let parsedData;
    
    try {
      parsedData = JSON.parse(responseData);
    } catch (e) {
      parsedData = responseData;
    }
    
    console.log(`Status: ${response.status}`);
    console.log('Response:');
    console.log(typeof parsedData === 'object' ? JSON.stringify(parsedData, null, 2) : parsedData);
    
    return {
      status: response.status,
      data: parsedData
    };
  } catch (error) {
    console.error(`Error calling API: ${error.message}`);
    return {
      status: 0,
      error: error.message
    };
  }
}

// Test function with assertions
async function runTest(name, testFn) {
  results.total++;
  console.log(`\n= TEST: ${name} =`);
  
  try {
    const testResult = await testFn();
    
    if (testResult.skipped) {
      console.log(`SKIPPED: ${testResult.reason}`);
      results.skipped++;
      results.tests.push({ name, status: 'SKIPPED', reason: testResult.reason });
      return { success: false, skipped: true };
    }
    
    if (testResult.success) {
      console.log('PASSED');
      results.passed++;
      results.tests.push({ name, status: 'PASSED' });
      return { success: true };
    } else {
      console.log(`FAILED: ${testResult.reason}`);
      results.failed++;
      results.tests.push({ 
        name, 
        status: 'FAILED', 
        reason: testResult.reason,
        expected: testResult.expected,
        actual: testResult.actual
      });
      return { success: false };
    }
  } catch (error) {
    console.error(`Test error: ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: 'FAILED', reason: error.message });
    return { success: false };
  }
}

// Print summary
function printSummary() {
  console.log('\n===== TEST SUMMARY =====');
  console.log(`Environment: ${environment}`);
  console.log(`API URL: ${API_URL}`);
  console.log(`Total: ${results.total}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);
  
  if (results.failed > 0) {
    console.log('\nFailed Tests:');
    results.tests
      .filter(test => test.status === 'FAILED')
      .forEach(test => {
        console.log(`- ${test.name}: ${test.reason}`);
      });
  }
  
  console.log('\n=========================');
}

// Run all tests
async function runAllTests() {
  console.log(`API Endpoint Tester - ${environment.toUpperCase()} Environment`);
  console.log('==========================================');
  console.log(`Testing against API: ${API_URL}`);
  
  // Test 1: Get Models
  let modelsResponse = null;
  await runTest('Get Models', async () => {
    modelsResponse = await callApi('GET', '/models');
    
    if (modelsResponse.status !== 200) {
      return { 
        success: false,
        reason: `Expected status 200, got ${modelsResponse.status}`,
        expected: 200,
        actual: modelsResponse.status
      };
    }
    
    if (!Array.isArray(modelsResponse.data)) {
      return { 
        success: false,
        reason: 'Expected array of models',
        expected: 'array',
        actual: typeof modelsResponse.data
      };
    }
    
    return { success: true };
  });
  
  // Test 2: Get Voices
  let voicesResponse = null;
  await runTest('Get Voices', async () => {
    voicesResponse = await callApi('GET', '/voices');
    
    if (voicesResponse.status !== 200) {
      return { 
        success: false,
        reason: `Expected status 200, got ${voicesResponse.status}`,
        expected: 200,
        actual: voicesResponse.status
      };
    }
    
    if (!Array.isArray(voicesResponse.data)) {
      return { 
        success: false,
        reason: 'Expected array of voices',
        expected: 'array',
        actual: typeof voicesResponse.data
      };
    }
    
    return { success: true };
  });
  
  // Test 3: Create Call
  let callId = null;
  await runTest('Create Call', async () => {
    // Skip this test in non-dev environments if using the test phone number
    if (environment !== 'dev' && TEST_PHONE_NUMBER === '+15555555555') {
      return { 
        skipped: true,
        reason: 'Test phone number not configured for non-dev environment'
      };
    }
    
    const callData = {
      phoneNumber: TEST_PHONE_NUMBER,
      script: "Hello, this is a test call from the API tester. Please ignore this call. Thank you and have a nice day.",
      modelId: modelsResponse?.data?.[0]?.id || 'claude-3-opus-20240229',
      voiceId: voicesResponse?.data?.[0]?.id || 'ailevelup-masculine-calm-expressive'
    };
    
    const response = await callApi('POST', '/call', callData);
    
    if (response.status !== 200 && response.status !== 201) {
      return { 
        success: false,
        reason: `Expected status 200 or 201, got ${response.status}`,
        expected: '200 or 201',
        actual: response.status
      };
    }
    
    if (!response.data.callId) {
      return { 
        success: false,
        reason: 'No callId in response',
        expected: 'callId property',
        actual: JSON.stringify(response.data)
      };
    }
    
    callId = response.data.callId;
    return { success: true };
  });
  
  // Test 4: Get Call Details
  await runTest('Get Call Details', async () => {
    if (!callId) {
      return { 
        skipped: true,
        reason: 'Call creation failed or was skipped, no callId available'
      };
    }
    
    const response = await callApi('GET', `/call/${callId}`);
    
    if (response.status !== 200) {
      return { 
        success: false,
        reason: `Expected status 200, got ${response.status}`,
        expected: 200,
        actual: response.status
      };
    }
    
    if (!response.data.callId || response.data.callId !== callId) {
      return { 
        success: false,
        reason: 'Call ID mismatch',
        expected: callId,
        actual: response.data.callId
      };
    }
    
    return { success: true };
  });
  
  // Test 5: List Calls
  await runTest('List Calls', async () => {
    const response = await callApi('GET', '/calls');
    
    if (response.status !== 200) {
      return { 
        success: false,
        reason: `Expected status 200, got ${response.status}`,
        expected: 200,
        actual: response.status
      };
    }
    
    if (!Array.isArray(response.data)) {
      return { 
        success: false,
        reason: 'Expected array of calls',
        expected: 'array',
        actual: typeof response.data
      };
    }
    
    return { success: true };
  });
  
  // Print summary of all tests
  printSummary();
}

// Start tests
runAllTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
}); 