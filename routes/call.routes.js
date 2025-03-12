const express = require('express');
const router = express.Router();
const { validateApiKey } = require('../middlewares/auth.middleware');
const callController = require('../controllers/call.controller');

// Apply API key validation to all routes
router.use(validateApiKey);

// Send a call
router.post('/', callController.sendCall);

// Analyze a call
router.post('/:callId/analyze', callController.analyzeCall);

// Stop a call
router.post('/:callId/stop', callController.stopCall);

// Get call details
router.get('/:callId', callController.getCallDetails);

// Get call event stream
router.get('/event_stream/:callId', callController.getEventStream);

// Get call recording
router.get('/:callId/recording', callController.getCallRecording);

// Get corrected transcripts
router.get('/:callId/correct', callController.getCorrectedTranscripts);

module.exports = router; 