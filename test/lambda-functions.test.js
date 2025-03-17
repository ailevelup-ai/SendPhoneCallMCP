/**
 * Unit Tests for AWS Lambda Functions
 * 
 * This script directly tests the Lambda function handlers
 * without going through API Gateway
 */

const { describe, it, before, after } = require('mocha');
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const path = require('path');
const dotenv = require('dotenv');
const AWS = require('aws-sdk');

// Load environment variables
dotenv.config();

// Dynamically load lambda functions
const makeCall = require('../functions/make-call');
const getCallDetails = require('../functions/get-call-details');
const listCalls = require('../functions/list-calls');
const getVoiceOptions = require('../functions/get-voice-options');
const getModelOptions = require('../functions/get-model-options');
const updateCallStatus = require('../functions/update-call-status');

// Test configuration
const TEST_PHONE_NUMBER = process.env.TEST_PHONE_NUMBER || '+15555555555';

// Mock event objects for Lambda functions
const makeCallEvent = {
  body: JSON.stringify({
    toNumber: TEST_PHONE_NUMBER,
    model: 'claude-3-opus-20240229',
    voice: 'alloy',
    temperature: 0.7,
    text: "This is a test call from the unit test suite."
  })
};

const getCallDetailsEvent = (callId) => ({
  pathParameters: {
    callId: callId
  }
});

const listCallsEvent = {
  queryStringParameters: null
};

const getVoiceOptionsEvent = {
  queryStringParameters: null
};

const getModelOptionsEvent = {
  queryStringParameters: null
};

const updateCallStatusEvent = {
  // EventBridge scheduled event
};

// Mock context object for Lambda
const mockContext = {
  awsRequestId: 'test-request-123',
  getRemainingTimeInMillis: () => 30000
};

// Helper to convert Lambda response to testable format
const parseResponse = (response) => {
  return {
    statusCode: response.statusCode,
    body: JSON.parse(response.body)
  };
};

// Setup stubs and mocks
let awsStubs = {};

// DynamoDB Document Client mock
const setupDynamoDBMock = () => {
  const mockDynamoDB = {
    put: sinon.stub().returns({
      promise: sinon.stub().resolves({})
    }),
    get: sinon.stub().returns({
      promise: sinon.stub().resolves({
        Item: {
          id: 'test-id',
          count: 5,
          expiresAt: Math.floor(Date.now() / 1000) + 3600
        }
      })
    }),
    update: sinon.stub().returns({
      promise: sinon.stub().resolves({})
    })
  };
  
  awsStubs.dynamoDb = sinon.stub(AWS, 'DynamoDB').returns({
    DocumentClient: function() {
      return mockDynamoDB;
    }
  });
  
  return mockDynamoDB;
};

describe('Lambda Function Tests', function() {
  this.timeout(10000); // Increase timeout for all tests
  
  let dynamoDbMock;
  let callId;
  
  before(function() {
    // Setup mocks before running tests
    dynamoDbMock = setupDynamoDBMock();
    
    // Add other mocks as needed
    // For example, mocking the Supabase client or fetch calls
  });
  
  after(function() {
    // Restore all stubs
    Object.values(awsStubs).forEach(stub => {
      if (stub && typeof stub.restore === 'function') {
        stub.restore();
      }
    });
  });
  
  describe('get-voice-options', function() {
    it('should return a list of voice options', async function() {
      const response = await getVoiceOptions.handler(getVoiceOptionsEvent, mockContext);
      const parsed = parseResponse(response);
      
      expect(response.statusCode).to.equal(200);
      expect(parsed.body).to.be.an('array');
      expect(parsed.body.length).to.be.greaterThan(0);
      
      // Validate the structure of a voice option
      const firstVoice = parsed.body[0];
      expect(firstVoice).to.have.property('id');
      expect(firstVoice).to.have.property('name');
    });
  });
  
  describe('get-model-options', function() {
    it('should return a list of model options', async function() {
      const response = await getModelOptions.handler(getModelOptionsEvent, mockContext);
      const parsed = parseResponse(response);
      
      expect(response.statusCode).to.equal(200);
      expect(parsed.body).to.be.an('array');
      expect(parsed.body.length).to.be.greaterThan(0);
      
      // Validate the structure of a model option
      const firstModel = parsed.body[0];
      expect(firstModel).to.have.property('id');
      expect(firstModel).to.have.property('name');
    });
  });
  
  describe('make-call', function() {
    it('should create a new call', async function() {
      // We need to mock the AILevelUp API call here
      const response = await makeCall.handler(makeCallEvent, mockContext);
      const parsed = parseResponse(response);
      
      expect(response.statusCode).to.equal(201);
      expect(parsed.body).to.have.property('callId');
      
      // Save callId for use in subsequent tests
      callId = parsed.body.callId;
    });
    
    it('should reject invalid requests', async function() {
      const invalidEvent = {
        body: JSON.stringify({
          // Missing required fields
          model: 'claude-3-opus-20240229'
        })
      };
      
      const response = await makeCall.handler(invalidEvent, mockContext);
      expect(response.statusCode).to.equal(400);
    });
  });
  
  describe('get-call-details', function() {
    it('should get details of a specific call', async function() {
      // Skip if no callId from previous test
      if (!callId) this.skip();
      
      const response = await getCallDetails.handler(getCallDetailsEvent(callId), mockContext);
      const parsed = parseResponse(response);
      
      expect(response.statusCode).to.equal(200);
      expect(parsed.body).to.have.property('callId').that.equals(callId);
    });
    
    it('should return 404 for non-existent call', async function() {
      const response = await getCallDetails.handler(getCallDetailsEvent('non-existent-id'), mockContext);
      expect(response.statusCode).to.equal(404);
    });
  });
  
  describe('list-calls', function() {
    it('should list all calls', async function() {
      const response = await listCalls.handler(listCallsEvent, mockContext);
      const parsed = parseResponse(response);
      
      expect(response.statusCode).to.equal(200);
      expect(parsed.body).to.be.an('array');
      
      // If we made a call earlier, verify it shows up in the list
      if (callId) {
        const foundCall = parsed.body.find(call => call.callId === callId);
        expect(foundCall).to.exist;
      }
    });
  });
  
  describe('update-call-status', function() {
    it('should update pending call statuses', async function() {
      const response = await updateCallStatus.handler(updateCallStatusEvent, mockContext);
      
      // This function doesn't return a HTTP response, it returns direct results
      expect(response).to.be.an('object');
      expect(response).to.have.property('processedCalls');
      expect(response.processedCalls).to.be.a('number');
    });
  });
}); 