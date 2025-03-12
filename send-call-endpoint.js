// Send Call API Endpoint for Bland.AI MCP Wrapper
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Import services
const { validateApiKey } = require('../services/auth');
const { deductCredits, checkBalance } = require('../services/billing');
const { moderateContent, logModerationResult } = require('../services/moderation');
const { logCallToGoogleSheets } = require('../services/logging');
const { getUser } = require('../services/user');

// Bland.AI API configuration
const BLAND_API_BASE_URL = 'https://api.bland.ai/v1';
const BLAND_API_KEY = process.env.BLAND_ENTERPRISE_API_KEY;

// Middleware to validate API key
router.use(validateApiKey);

/**
 * @route POST /api/v1/calls
 * @description Initiate an outbound call via Bland.AI
 * @access Private (requires API key)
 */
router.post('/calls', async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const apiKey = req.headers['x-api-key'];
  let user;
  
  try {
    // Get user from API key
    user = await getUser(apiKey);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid API key',
        request_id: requestId
      });
    }
    
    // Check if user has sufficient credits
    const balanceCheck = await checkBalance(user.id);
    if (!balanceCheck.hasBalance && !user.freeMinutesRemaining) {
      return res.status(402).json({
        status: 'error',
        message: 'Insufficient credits. Please add funds to your account.',
        current_balance: balanceCheck.balance,
        request_id: requestId
      });
    }
    
    // Validate request parameters
    const validationError = validateCallParams(req.body);
    if (validationError) {
      return res.status(400).json({
        status: 'error',
        message: validationError,
        request_id: requestId
      });
    }
    
    // Moderate content
    const moderationResult = await moderateContent(req.body);
    await logModerationResult(moderationResult, req.body, user.id);
    
    if (!moderationResult.isAllowed) {
      return res.status(400).json({
        status: 'error',
        message: `Content moderation failed: ${moderationResult.reason}`,
        moderation_id: moderationResult.moderationId,
        request_id: requestId
      });
    }
    
    // Prepare request for Bland.AI API
    const blandParams = prepareBlandParams(req.body, user);
    
    // Make request to Bland.AI API
    const blandResponse = await axios.post(`${BLAND_API_BASE_URL}/calls`, blandParams, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': BLAND_API_KEY
      }
    });
    
    // Extract call_id from Bland.AI response
    const { call_id, status, message } = blandResponse.data;
    
    // Log to Google Sheets
    await logCallToGoogleSheets({
      api_key: apiKey,
      user_id: user.id,
      call_id: call_id,
      phone_number: req.body.phone_number,
      call_status: status,
      webhook: req.body.webhook || null,
      voice: req.body.voice || 'default',
      task: req.body.task,
      moderation_status: 'passed',
      model: req.body.model || 'default',
      from: req.body.from || null,
      request_parameters: req.body,
      response_parameters: blandResponse.data
    });
    
    // Return response to client
    return res.status(200).json({
      status: 'success',
      message: 'Call successfully queued',
      call_id: call_id,
      batch_id: null,
      request_id: requestId,
      latency_ms: Date.now() - startTime
    });
    
  } catch (error) {
    console.error('Error in send call endpoint:', error);
    
    // Log failed attempt
    if (user) {
      await logCallToGoogleSheets({
        api_key: apiKey,
        user_id: user.id,
        call_id: null,
        phone_number: req.body.phone_number,
        call_status: 'error',
        webhook: req.body.webhook || null,
        voice: req.body.voice || 'default',
        task: req.body.task,
        moderation_status: 'error',
        model: req.body.model || 'default',
        from: req.body.from || null,
        error_message: error.message,
        request_parameters: req.body
      });
    }
    
    // Return error response
    return res.status(500).json({
      status: 'error',
      message: 'Failed to initiate call',
      error: error.message,
      request_id: requestId
    });
  }
});

/**
 * Validate call parameters
 * @param {Object} params - Call parameters
 * @returns {String|null} - Error message or null if valid
 */
function validateCallParams(params) {
  // Validate required fields
  if (!params.phone_number) {
    return 'phone_number is required';
  }
  
  if (!params.task) {
    return 'task is required';
  }
  
  // Validate phone number format
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(params.phone_number.replace(/\D/g, ''))) {
    return 'Invalid phone number format';
  }
  
  // Validate task length
  if (params.task.length < 10) {
    return 'task must be at least 10 characters';
  }
  
  return null;
}

/**
 * Prepare parameters for Bland.AI API
 * @param {Object} params - Original parameters from client
 * @param {Object} user - User object
 * @returns {Object} - Parameters for Bland.AI API
 */
function prepareBlandParams(params, user) {
  // Clone the params to avoid modifying the original
  const blandParams = JSON.parse(JSON.stringify(params));
  
  // Override 'from' with Twilio number if not provided
  if (!blandParams.from) {
    blandParams.from = process.env.DEFAULT_TWILIO_NUMBER;
  }
  
  // Setup webhook if the client provided one
  if (blandParams.webhook) {
    // Store the original webhook
    const originalWebhook = blandParams.webhook;
    
    // Replace with our webhook that will forward to the client's webhook
    blandParams.webhook = `${process.env.MCP_BASE_URL}/api/v1/webhooks/forward?target=${encodeURIComponent(originalWebhook)}&user_id=${user.id}`;
  }
  
  // Add metadata for tracking
  blandParams.metadata = {
    ...blandParams.metadata,
    mcp_user_id: user.id,
    mcp_request_id: uuidv4()
  };
  
  return blandParams;
}

/**
 * Webhook forwarding endpoint
 * @route POST /api/v1/webhooks/forward
 * @description Forward webhooks from Bland.AI to client's webhook
 */
router.post('/webhooks/forward', async (req, res) => {
  const { target, user_id } = req.query;
  
  if (!target) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing target webhook URL'
    });
  }
  
  try {
    // Forward the webhook payload to the client's webhook
    await axios.post(target, req.body);
    
    // Return success response
    return res.status(200).json({
      status: 'success',
      message: 'Webhook forwarded successfully'
    });
  } catch (error) {
    console.error('Error forwarding webhook:', error);
    
    // Return error response
    return res.status(500).json({
      status: 'error',
      message: 'Failed to forward webhook',
      error: error.message
    });
  }
});

module.exports = router;
