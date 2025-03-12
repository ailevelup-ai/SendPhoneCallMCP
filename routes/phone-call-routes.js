const express = require('express');
const router = express.Router();
const phoneCallController = require('../controllers/phone-call-controller');
const authMiddleware = require('../middleware/auth');
const rateLimitMiddleware = require('../middleware/rate-limit');

// Apply authentication middleware to all routes
router.use(authMiddleware.authenticate);

// Send a phone call
router.post(
  '/calls',
  rateLimitMiddleware.limitByUser(10, 60), // 10 requests per minute per user
  phoneCallController.sendCall
);

// Get call details
router.get(
  '/calls/:callId',
  rateLimitMiddleware.limitByUser(30, 60), // 30 requests per minute per user
  phoneCallController.getCallDetails
);

// Stop a call
router.post(
  '/calls/:callId/stop',
  rateLimitMiddleware.limitByUser(10, 60), // 10 requests per minute per user
  phoneCallController.stopCall
);

// Analyze a call
router.post(
  '/calls/:callId/analyze',
  rateLimitMiddleware.limitByUser(5, 60), // 5 requests per minute per user
  phoneCallController.analyzeCall
);

// Get call recording
router.get(
  '/calls/:callId/recording',
  rateLimitMiddleware.limitByUser(5, 60), // 5 requests per minute per user
  phoneCallController.getCallRecording
);

// Get corrected transcript
router.get(
  '/calls/:callId/transcript',
  rateLimitMiddleware.limitByUser(10, 60), // 10 requests per minute per user
  phoneCallController.getCorrectedTranscript
);

// Get event stream
router.get(
  '/calls/:callId/events',
  rateLimitMiddleware.limitByUser(5, 60), // 5 requests per minute per user
  phoneCallController.getEventStream
);

// Get user's call history
router.get(
  '/calls',
  rateLimitMiddleware.limitByUser(20, 60), // 20 requests per minute per user
  phoneCallController.getUserCallHistory
);

// Update call metadata
router.patch(
  '/calls/:callId/metadata',
  rateLimitMiddleware.limitByUser(20, 60), // 20 requests per minute per user
  phoneCallController.updateCallMetadata
);

module.exports = router; 