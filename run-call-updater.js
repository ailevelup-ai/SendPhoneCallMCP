/**
 * Script to manually log a call to Google Sheets and then update it
 * This bypasses the API authentication and directly uses the Google Sheets logging module
 */

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const {
  logCallToGoogleSheets, 
  updateCallInGoogleSheets
} = require('./google-sheets-logging');

// Task prompt for joke sharing
const TASK_PROMPT = `You're calling to share some jokes with the user. Your goal is to keep them on the phone for at least one minute. Be friendly and engaging, introducing yourself as a comedy enthusiast who wants to brighten their day with a few jokes. Ask them what type of jokes they prefer (puns, dad jokes, etc.) and tailor your jokes to their preference if they give one. If they don't have a preference, start with general crowd-pleasing jokes.

After each joke, briefly pause to give them a chance to laugh or react, then ask if they'd like to hear another one. Keep track of which jokes seem to make them laugh the most. If they're not laughing at certain types of jokes, pivot to a different style. Your tone should be upbeat and enthusiastic, as if you're genuinely enjoying sharing jokes with them.

Continue telling jokes until either: 1) you've been on the call for more than one minute, at which point you can thank them for their time and end the call, or 2) they indicate they want to end the call. Don't mention explicitly that your goal is to keep them on the line for one minute.`;

// Summary prompt for joke analysis
const SUMMARY_PROMPT = `Create a numbered list of all jokes you told during the call. For each joke, include:
1. The exact joke text
2. A humor score from 0-10 rating how much the user laughed (with 10 being the most laughter)
3. A brief note on their reaction (e.g., "loud laughter," "slight chuckle," "no reaction")

After the numbered joke list, provide a brief analysis of:
- Total time spent on the call
- Whether the one-minute goal was achieved
- Which joke style seemed most effective with this particular user
- Any observations about what made the user laugh or not laugh`;

// Function to create a simulated call
async function createSimulatedCall() {
  // Generate a random call ID
  const callId = uuidv4();
  console.log(`Generated call ID: ${callId}`);
  
  // Prepare call data
  const callData = {
    call_id: callId,
    phone_number: '+12129965776',
    user_id: 'dev-user-id',
    voice: 'nat',
    model: 'turbo',
    api_key: 'dev-key',
    task: TASK_PROMPT,
    summary_prompt: SUMMARY_PROMPT,
    call_status: 'initiated',
    credits_used: 1,
    webhook: 'http://localhost:3040/webhook',
    request_parameters: {
      task: TASK_PROMPT,
      summary_prompt: SUMMARY_PROMPT
    },
    response_parameters: {
      call_id: callId
    }
  };
  
  // Log to Google Sheets
  console.log('Logging call to Google Sheets...');
  const success = await logCallToGoogleSheets(callData);
  
  if (success) {
    console.log(`Call successfully logged to Google Sheets with ID: ${callId}`);
    return callId;
  } else {
    console.error('Failed to log call to Google Sheets');
    return null;
  }
}

// Execute the script
async function main() {
  // Check if we're updating an existing call
  const existingCallId = process.argv[2];
  
  if (existingCallId) {
    console.log(`Starting update for call ID: ${existingCallId}`);
    
    // For existing calls, just update the Sheets entry (assumes call already in Google Sheets)
    const rowIndex = 0; // 0 means the function will search for the row
    await updateCallInGoogleSheets(existingCallId, rowIndex);
    console.log('Call update completed successfully');
  } else {
    console.log('Creating a new simulated call and logging it to Google Sheets');
    const callId = await createSimulatedCall();
    
    if (callId) {
      console.log(`\nCall created with ID: ${callId}`);
      console.log(`To update this call later, run: node run-call-updater.js ${callId}`);
    }
  }
}

// Run the main function
main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 