const phoneCallService = require('../services/phone-call');
const logger = require('../services/logging');

/**
 * Send a phone call
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function sendCall(req, res) {
  try {
    const userId = req.user.id;
    const callData = req.body;

    // Validate request
    if (!callData.phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    if (!callData.script) {
      return res.status(400).json({ error: 'Script is required' });
    }

    // Process the call
    const result = await phoneCallService.sendCall(callData, userId);

    // Return success response
    return res.status(200).json({
      success: true,
      callId: result.callId,
      status: result.status,
      estimatedCost: result.estimatedCost,
      message: 'Call initiated successfully'
    });
  } catch (error) {
    logger.error('Error in sendCall controller', { error: error.message, userId: req.user.id });
    
    // Handle specific error types
    if (error.message.includes('Content moderation failed')) {
      return res.status(403).json({ error: error.message });
    }
    
    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({ error: error.message });
    }
    
    if (error.message.includes('Bland.AI API error')) {
      return res.status(502).json({ error: error.message });
    }
    
    return res.status(500).json({ error: 'Failed to initiate call' });
  }
}

/**
 * Get call details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getCallDetails(req, res) {
  try {
    const userId = req.user.id;
    const { callId } = req.params;

    if (!callId) {
      return res.status(400).json({ error: 'Call ID is required' });
    }

    const callDetails = await phoneCallService.getCallDetails(callId, userId);
    
    return res.status(200).json({
      success: true,
      call: callDetails
    });
  } catch (error) {
    logger.error('Error in getCallDetails controller', { 
      error: error.message, 
      userId: req.user.id,
      callId: req.params.callId
    });
    
    if (error.message.includes('not found') || error.message.includes('not authorized')) {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message.includes('Bland.AI API error')) {
      return res.status(502).json({ error: error.message });
    }
    
    return res.status(500).json({ error: 'Failed to get call details' });
  }
}

/**
 * Stop an ongoing call
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function stopCall(req, res) {
  try {
    const userId = req.user.id;
    const { callId } = req.params;

    if (!callId) {
      return res.status(400).json({ error: 'Call ID is required' });
    }

    const result = await phoneCallService.stopCall(callId, userId);
    
    return res.status(200).json({
      success: true,
      message: 'Call stopped successfully'
    });
  } catch (error) {
    logger.error('Error in stopCall controller', { 
      error: error.message, 
      userId: req.user.id,
      callId: req.params.callId
    });
    
    if (error.message.includes('not found') || error.message.includes('not authorized')) {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message.includes('Bland.AI API error')) {
      return res.status(502).json({ error: error.message });
    }
    
    return res.status(500).json({ error: 'Failed to stop call' });
  }
}

/**
 * Analyze a call
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function analyzeCall(req, res) {
  try {
    const userId = req.user.id;
    const { callId } = req.params;
    const options = req.body || {};

    if (!callId) {
      return res.status(400).json({ error: 'Call ID is required' });
    }

    const analysisResult = await phoneCallService.analyzeCall(callId, userId, options);
    
    return res.status(200).json({
      success: true,
      analysis: analysisResult
    });
  } catch (error) {
    logger.error('Error in analyzeCall controller', { 
      error: error.message, 
      userId: req.user.id,
      callId: req.params.callId
    });
    
    if (error.message.includes('not found') || error.message.includes('not authorized')) {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message.includes('Bland.AI API error')) {
      return res.status(502).json({ error: error.message });
    }
    
    return res.status(500).json({ error: 'Failed to analyze call' });
  }
}

/**
 * Get call recording
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getCallRecording(req, res) {
  try {
    const userId = req.user.id;
    const { callId } = req.params;

    if (!callId) {
      return res.status(400).json({ error: 'Call ID is required' });
    }

    const recording = await phoneCallService.getCallRecording(callId, userId);
    
    // Set appropriate headers for streaming audio
    res.setHeader('Content-Type', recording.contentType);
    if (recording.contentLength) {
      res.setHeader('Content-Length', recording.contentLength);
    }
    
    // Stream the recording to the client
    recording.stream.pipe(res);
  } catch (error) {
    logger.error('Error in getCallRecording controller', { 
      error: error.message, 
      userId: req.user.id,
      callId: req.params.callId
    });
    
    if (error.message.includes('not found') || error.message.includes('not authorized')) {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message.includes('Bland.AI API error')) {
      return res.status(502).json({ error: error.message });
    }
    
    return res.status(500).json({ error: 'Failed to get call recording' });
  }
}

/**
 * Get corrected transcript
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getCorrectedTranscript(req, res) {
  try {
    const userId = req.user.id;
    const { callId } = req.params;

    if (!callId) {
      return res.status(400).json({ error: 'Call ID is required' });
    }

    const transcript = await phoneCallService.getCorrectedTranscript(callId, userId);
    
    return res.status(200).json({
      success: true,
      transcript
    });
  } catch (error) {
    logger.error('Error in getCorrectedTranscript controller', { 
      error: error.message, 
      userId: req.user.id,
      callId: req.params.callId
    });
    
    if (error.message.includes('not found') || error.message.includes('not authorized')) {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message.includes('Bland.AI API error')) {
      return res.status(502).json({ error: error.message });
    }
    
    return res.status(500).json({ error: 'Failed to get call transcript' });
  }
}

/**
 * Get event stream
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getEventStream(req, res) {
  try {
    const userId = req.user.id;
    const { callId } = req.params;

    if (!callId) {
      return res.status(400).json({ error: 'Call ID is required' });
    }

    const eventStream = await phoneCallService.getEventStream(callId, userId);
    
    // Set appropriate headers for streaming
    res.setHeader('Content-Type', eventStream.contentType);
    
    // Stream the events to the client
    eventStream.stream.pipe(res);
  } catch (error) {
    logger.error('Error in getEventStream controller', { 
      error: error.message, 
      userId: req.user.id,
      callId: req.params.callId
    });
    
    if (error.message.includes('not found') || error.message.includes('not authorized')) {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message.includes('Bland.AI API error')) {
      return res.status(502).json({ error: error.message });
    }
    
    return res.status(500).json({ error: 'Failed to get event stream' });
  }
}

/**
 * Get user's call history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getUserCallHistory(req, res) {
  try {
    const userId = req.user.id;
    const { page, limit, status, startDate, endDate } = req.query;
    
    const options = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10
    };
    
    if (status) options.status = status;
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    
    const callHistory = await phoneCallService.getUserCallHistory(userId, options);
    
    return res.status(200).json({
      success: true,
      calls: callHistory.calls,
      pagination: callHistory.pagination
    });
  } catch (error) {
    logger.error('Error in getUserCallHistory controller', { 
      error: error.message, 
      userId: req.user.id
    });
    
    return res.status(500).json({ error: 'Failed to get call history' });
  }
}

/**
 * Update call metadata
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateCallMetadata(req, res) {
  try {
    const userId = req.user.id;
    const { callId } = req.params;
    const metadata = req.body;

    if (!callId) {
      return res.status(400).json({ error: 'Call ID is required' });
    }

    if (!metadata || Object.keys(metadata).length === 0) {
      return res.status(400).json({ error: 'Metadata is required' });
    }

    const updatedCall = await phoneCallService.updateCallMetadata(callId, userId, metadata);
    
    return res.status(200).json({
      success: true,
      message: 'Call metadata updated successfully',
      call: updatedCall
    });
  } catch (error) {
    logger.error('Error in updateCallMetadata controller', { 
      error: error.message, 
      userId: req.user.id,
      callId: req.params.callId
    });
    
    if (error.message.includes('not found') || error.message.includes('not authorized')) {
      return res.status(404).json({ error: error.message });
    }
    
    return res.status(500).json({ error: 'Failed to update call metadata' });
  }
}

module.exports = {
  sendCall,
  getCallDetails,
  stopCall,
  analyzeCall,
  getCallRecording,
  getCorrectedTranscript,
  getEventStream,
  getUserCallHistory,
  updateCallMetadata
}; 