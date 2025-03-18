import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { CallStatus, CallStatusReport, insertCall } from '../db';
import { useCredits } from '../credits/credits';

// Bland API configuration
const BLAND_API_URL = process.env.BLAND_API_URL || 'https://api.bland.ai/v1/calls';
const BLAND_API_KEY = process.env.BLAND_API_KEY;

// Voice price in credits
const VOICE_CALL_COST = 1;

// Make sure API key is set
if (!BLAND_API_KEY) {
  console.warn('BLAND_API_KEY is not set. Calls will not work correctly.');
}

/**
 * Make a phone call using the Bland AI API
 */
export async function makeCall({
  phoneNumber,
  task,
  voiceId,
  maxDuration = 300,
  temperature = 1,
  model = 'turbo',
  sessionId,
}: {
  phoneNumber: string;
  task: string;
  voiceId: string;
  maxDuration?: number;
  temperature?: number;
  model?: string;
  sessionId: string;
}): Promise<{ callId: string }> {
  try {
    // Generate a unique call ID
    const callId = uuidv4();
    
    // Check and use credits
    const hasCredits = await useCredits(sessionId, VOICE_CALL_COST);
    if (!hasCredits) {
      throw new Error('Insufficient credits to make this call');
    }
    
    // Store the call in the database first
    insertCall(callId, sessionId, phoneNumber, task, voiceId);
    
    // Prepare the API request
    const apiRequest = {
      phone_number: phoneNumber,
      task,
      voice_id: voiceId,
      reduce_latency: true,
      max_duration: maxDuration,
      temperature,
      model: model || 'turbo',
      webhook_url: process.env.CALL_STATUS_WEBHOOK_URL,
      metadata: {
        call_id: callId,
        session_id: sessionId
      }
    };
    
    // Make the API call
    const response = await axios.post(BLAND_API_URL, apiRequest, {
      headers: {
        'Authorization': `Bearer ${BLAND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Bland API call response:', response.data);
    
    // Return the call ID for tracking
    return { callId };
  } catch (error) {
    console.error('Error making Bland API call:', error);
    
    // If the API call failed, update the call status
    if (error.response) {
      console.error('API response error:', error.response.data);
    }
    
    throw new Error(`Failed to make call: ${error.message}`);
  }
}

/**
 * Get available voice options from Bland AI
 */
export async function getVoiceOptions(): Promise<any[]> {
  try {
    const response = await axios.get('https://api.bland.ai/v1/voices', {
      headers: {
        'Authorization': `Bearer ${BLAND_API_KEY}`
      }
    });
    
    return response.data.voices || [];
  } catch (error) {
    console.error('Error fetching voice options:', error);
    throw new Error(`Failed to get voice options: ${error.message}`);
  }
}

/**
 * Handle a call status update from the webhook
 */
export async function handleCallStatusUpdate(
  callId: string,
  status: CallStatus,
  duration?: number,
  error?: string
): Promise<CallStatusReport> {
  try {
    // Update the call status in the database
    const statusUpdate: CallStatusReport = {
      callId,
      status,
      duration,
      error
    };
    
    // Return the status update
    return statusUpdate;
  } catch (error) {
    console.error('Error handling call status update:', error);
    throw new Error(`Failed to update call status: ${error.message}`);
  }
} 