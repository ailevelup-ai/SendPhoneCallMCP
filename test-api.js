/**
 * API Testing Script for Phone Call MCP
 * 
 * This script tests all endpoints of the deployed API Gateway
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// Load environment variables
dotenv.config();

// Configuration
const API_URL = process.env.API_URL || 'https://ql3w5ogpvb.execute-api.us-east-1.amazonaws.com/dev';
const PHONE_NUMBER = process.env.TEST_PHONE_NUMBER || '+15555555555'; // Replace with an actual test number
const WAIT_TIME_MS = 15000; // Time to wait between tests in milliseconds

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

/**
 * Log an individual test result
 */
function logTestResult(testName, passed, response) {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ PASS: ${testName}`);
  } else {
    testResults.failed++;
    console.log(`❌ FAIL: ${testName}`);
    console.log(`  Response: ${JSON.stringify(response, null, 2)}`);
  }
  
  testResults.details.push({
    name: testName,
    passed,
    timestamp: new Date().toISOString(),
    response: response
  });
}

/**
 * Print final test summary
 */
function printTestSummary() {
  console.log('\n========== TEST SUMMARY ==========');
  console.log(`Total tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log(`Success rate: ${Math.round((testResults.passed / testResults.total) * 100)}%`);
  console.log('==================================\n');
  
  // Save test results to a file
  fs.writeFileSync(
    path.join(__dirname, 'test-results.json'), 
    JSON.stringify(testResults, null, 2)
  );
  console.log('Test results saved to test-results.json');
}

/**
 * Execute a single API test
 */
async function runTest(name, method, endpoint, body = null) {
  console.log(`\nTesting ${method} ${endpoint}...`);
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const url = `${API_URL}${endpoint}`;
    const response = await fetch(url, options);
    const data = await response.json();
    
    // Check if the request was successful
    const passed = response.ok && data && 
      (method === 'GET' ? true : data.callId || data.id);
    
    logTestResult(name, passed, {
      status: response.status,
      data: data
    });
    
    return data;
  } catch (error) {
    logTestResult(name, false, {
      error: error.message
    });
    return null;
  }
}

/**
 * Run all tests in sequence
 */
async function runAllTests() {
  console.log('Starting API tests...');
  console.log(`Using API URL: ${API_URL}`);
  
  // Test 1: Get models
  const models = await runTest('Get Models', 'GET', '/models');
  
  // Test 2: Get voices
  const voices = await runTest('Get Voices', 'GET', '/voices');
  
  // Test 3: Create a call
  const createCallPayload = {
    toNumber: PHONE_NUMBER,
    // Use the first model and voice from the lists if available
    model: models && models.length > 0 ? models[0].id : 'claude-3-opus-20240229',
    voice: voices && voices.length > 0 ? voices[0].id : 'alloy',
    temperature: 0.7,
    text: "Hello! This is a test call from the Phone Call MCP testing script. This call is being made to validate that our system is working correctly. If you're hearing this message, it means our deployment was successful."
  };
  
  const callResponse = await runTest('Create Call', 'POST', '/call', createCallPayload);
  
  if (callResponse && callResponse.callId) {
    console.log(`Call created with ID: ${callResponse.callId}`);
    
    // Wait a few seconds for the call to be processed
    console.log(`Waiting ${WAIT_TIME_MS/1000} seconds before checking call status...`);
    await sleep(WAIT_TIME_MS);
    
    // Test 4: Get call details
    await runTest('Get Call Details', 'GET', `/call/${callResponse.callId}`);
    
    // Test 5: List all calls
    await runTest('List Calls', 'GET', '/calls');
    
    // Wait longer to see if status gets updated by the EventBridge trigger
    console.log(`Waiting ${WAIT_TIME_MS/1000} seconds for potential status updates...`);
    await sleep(WAIT_TIME_MS);
    
    // Test 6: Check if call status was updated
    const updatedCallDetails = await runTest(
      'Check Call Status Update', 
      'GET', 
      `/call/${callResponse.callId}`
    );
    
    if (updatedCallDetails) {
      console.log(`Final call status: ${updatedCallDetails.status}`);
    }
  }
  
  // Print test summary
  printTestSummary();
}

// Run all tests
runAllTests().catch(error => {
  console.error('Test execution error:', error);
  process.exit(1);
}); 