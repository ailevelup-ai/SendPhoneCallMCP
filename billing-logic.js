// Call Tracking and Billing Service for Bland.AI MCP Wrapper
const axios = require('axios');
const db = require('../database');
const { deductCredits } = require('./credit-system');

// Bland.AI API configuration
const BLAND_API_BASE_URL = 'https://api.bland.ai/v1';
const BLAND_API_KEY = process.env.BLAND_ENTERPRISE_API_KEY;

// Polling interval in milliseconds (1 minute)
const POLLING_INTERVAL = 60000;

/**
 * Track a new call when initiated
 * @param {String} callId - Bland.AI call ID
 * @param {String} userId - User ID
 * @param {Object} callParams - Original call parameters
 * @returns {Object} - Tracked call object
 */
async function trackNewCall(callId, userId, callParams) {
  try {
    // Create entry in active_calls table
    const trackedCall = await db.activeCalls.create({
      callId,
      userId,
      status: 'in_progress',
      startTime: new Date(),
      lastCheckTime: new Date(),
      billedMinutes: 0,
      estimatedDuration: callParams.max_duration || 30, // Default to 30 minutes if not specified
      phoneNumber: callParams.phone_number,
      callParams: JSON.stringify(callParams),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Return the tracked call
    return {
      callId,
      userId,
      status: 'in_progress',
      startTime: trackedCall.startTime
    };
  } catch (error) {
    console.error('Error tracking new call:', error);
    throw error;
  }
}

/**
 * Update call status and billing based on current call details
 * @param {String} callId - Bland.AI call ID
 * @returns {Object} - Updated call details
 */
async function updateCallStatus(callId) {
  try {
    // Get the tracked call from database
    const trackedCall = await db.activeCalls.findOne({
      where: { callId }
    });
    
    if (!trackedCall) {
      throw new Error(`Call ${callId} not found in tracking system`);
    }
    
    // Skip if call is already completed and billed
    if (trackedCall.status === 'completed' && trackedCall.fullyBilled) {
      return {
        callId,
        status: 'completed',
        message: 'Call already completed and billed'
      };
    }
    
    // Get call details from Bland.AI
    const callDetails = await getCallDetailsFromBland(callId);
    
    // Update tracked call with latest details
    const updatedCall = await updateTrackedCall(trackedCall, callDetails);
    
    // If call is completed, process final billing
    if (callDetails.status === 'completed' && trackedCall.status !== 'completed') {
      await processFinalBilling(updatedCall, callDetails);
    }
    
    return {
      callId,
      status: callDetails.status,
      callLength: callDetails.call_length,
      billedMinutes: updatedCall.billedMinutes,
      isCompleted: callDetails.status === 'completed'
    };
  } catch (error) {
    console.error(`Error updating call status for ${callId}:`, error);
    
    // Log the error but don't re-throw to avoid breaking the polling loop
    return {
      callId,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Get call details from Bland.AI API
 * @param {String} callId - Call ID
 * @returns {Object} - Call details from Bland.AI
 */
async function getCallDetailsFromBland(callId) {
  try {
    const response = await axios.get(`${BLAND_API_BASE_URL}/calls/${callId}`, {
      headers: {
        'Authorization': BLAND_API_KEY
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error getting call details from Bland.AI:', error);
    throw new Error(`Failed to get call details: ${error.message}`);
  }
}

/**
 * Update tracked call with latest details
 * @param {Object} trackedCall - Tracked call from database
 * @param {Object} callDetails - Call details from Bland.AI
 * @returns {Object} - Updated tracked call
 */
async function updateTrackedCall(trackedCall, callDetails) {
  try {
    // Determine call status
    const newStatus = mapBlandStatusToInternal(callDetails.status);
    
    // Update last check time
    const updates = {
      lastCheckTime: new Date(),
      status: newStatus,
      callLength: callDetails.call_length || 0,
      updatedAt: new Date()
    };
    
    // Update call in database
    await db.activeCalls.update(updates, {
      where: { callId: trackedCall.callId }
    });
    
    // Get updated call
    const updatedCall = await db.activeCalls.findOne({
      where: { callId: trackedCall.callId }
    });
    
    return updatedCall;
  } catch (error) {
    console.error('Error updating tracked call:', error);
    throw error;
  }
}

/**
 * Process final billing for a completed call
 * @param {Object} trackedCall - Tracked call from database
 * @param {Object} callDetails - Call details from Bland.AI
 * @returns {Object} - Billing result
 */
async function processFinalBilling(trackedCall, callDetails) {
  try {
    // Get call length in minutes, rounded up to nearest minute
    const callLengthMinutes = Math.ceil(callDetails.call_length || 0);
    
    // Skip if call duration is 0
    if (callLengthMinutes <= 0) {
      await db.activeCalls.update(
        { fullyBilled: true },
        { where: { callId: trackedCall.callId } }
      );
      
      return {
        callId: trackedCall.callId,
        message: 'Call had zero duration, no billing needed'
      };
    }
    
    // Check if already fully billed
    if (trackedCall.billedMinutes >= callLengthMinutes) {
      await db.activeCalls.update(
        { fullyBilled: true },
        { where: { callId: trackedCall.callId } }
      );
      
      return {
        callId: trackedCall.callId,
        message: 'Call already fully billed'
      };
    }
    
    // Calculate minutes to bill
    const minutesToBill = callLengthMinutes - trackedCall.billedMinutes;
    
    // Deduct credits for unbilled minutes
    const billingResult = await deductCredits(
      trackedCall.userId,
      trackedCall.callId,
      minutesToBill
    );
    
    // Update billing status
    await db.activeCalls.update(
      {
        billedMinutes: callLengthMinutes,
        fullyBilled: true,
        billingDetails: JSON.stringify(billingResult)
      },
      { where: { callId: trackedCall.callId } }
    );
    
    return {
      callId: trackedCall.callId,
      minutesBilled: minutesToBill,
      totalMinutes: callLengthMinutes,
      billingDetails: billingResult
    };
  } catch (error) {
    console.error('Error processing final billing:', error);
    throw error;
  }
}

/**
 * Map Bland.AI status to internal status
 * @param {String} blandStatus - Status from Bland.AI
 * @returns {String} - Internal status
 */
function mapBlandStatusToInternal(blandStatus) {
  const statusMap = {
    'queued': 'in_progress',
    'in-progress': 'in_progress',
    'ringing': 'in_progress',
    'completed': 'completed',
    'failed': 'failed',
    'error': 'failed',
    'busy': 'failed',
    'no-answer': 'failed'
  };
  
  return statusMap[blandStatus] || 'unknown';
}

/**
 * Poll for active calls and update status
 * @returns {Array} - Results of update operations
 */
async function pollActiveCalls() {
  try {
    // Get all active calls
    const activeCalls = await db.activeCalls.findAll({
      where: {
        status: 'in_progress',
        fullyBilled: false
      }
    });
    
    // Skip if no active calls
    if (activeCalls.length === 0) {
      return { message: 'No active calls to update' };
    }
    
    // Update each call
    const updateResults = await Promise.all(
      activeCalls.map(call => updateCallStatus(call.callId))
    );
    
    return {
      processed: updateResults.length,
      results: updateResults
    };
  } catch (error) {
    console.error('Error polling active calls:', error);
    return { error: error.message };
  }
}

/**
 * Start the polling service
 */
function startPollingService() {
  // Call once immediately
  pollActiveCalls();
  
  // Set up interval
  setInterval(pollActiveCalls, POLLING_INTERVAL);
  
  console.log(`Call tracking polling service started with ${POLLING_INTERVAL}ms interval`);
}

module.exports = {
  trackNewCall,
  updateCallStatus,
  getCallDetailsFromBland,
  startPollingService
};
