/**
 * Voice Sample API
 * 
 * This endpoint handles requests to generate voice samples using Bland AI's text-to-speech API.
 * It accepts POST requests with voice_id and text parameters and returns an audio file.
 */

const axios = require('axios');
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../../middlewares/auth');
const config = require('../../config');

router.post('/voice-sample', async (req, res) => {
  try {
    const { voice_id, text } = req.body;
    
    if (!voice_id || !text) {
      return res.status(400).json({ 
        error: 'Missing required parameters', 
        message: 'Both voice_id and text are required' 
      });
    }
    
    // Limit sample text length
    const sampleText = text.substring(0, 300);
    
    console.log(`Generating voice sample for voice_id: ${voice_id}`);
    
    // Call the Bland AI API
    const blandApiResponse = await axios({
      method: 'post',
      url: `${config.BLAND_API_URL}/v1/text-to-speech`,
      headers: {
        'Authorization': config.BLAND_API_KEY,
        'Content-Type': 'application/json'
      },
      data: {
        voice_id: voice_id,
        text: sampleText,
        format: 'mp3',
        speed: 1.0,
        enable_timestamps: false,
        quality: 'standard'
      },
      responseType: 'arraybuffer'
    });
    
    // Set appropriate headers for audio response
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="voice-sample.mp3"');
    
    // Send the audio data back to the client
    res.send(blandApiResponse.data);
    
  } catch (error) {
    console.error('Error generating voice sample:', error);
    
    let statusCode = 500;
    let errorMessage = 'Failed to generate voice sample';
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API error response:', {
        status: error.response.status,
        data: error.response.data
      });
      
      statusCode = error.response.status;
      errorMessage = typeof error.response.data === 'string' 
        ? error.response.data 
        : error.response.data.error || error.response.data.message || errorMessage;
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from API:', error.request);
      errorMessage = 'No response received from voice API';
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({
      error: 'Voice sample generation failed',
      message: errorMessage
    });
  }
});

module.exports = router; 