/**
 * Script to make a test phone call using the phone-calls API endpoint
 */

const axios = require('axios');

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

// Phone number to call - replace with the desired test number
const PHONE_NUMBER = '+12129965776';

// Make the call
async function makeCall() {
  try {
    console.log('Making phone call...');
    const response = await axios.post('http://localhost:3040/api/v1/phone-calls/call', {
      phoneNumber: PHONE_NUMBER,
      voice: 'nat',
      model: 'turbo',
      task: TASK_PROMPT,
      summary_prompt: SUMMARY_PROMPT
    }, {
      headers: {
        'Content-Type': 'application/json',
        // Using a dummy development API key
        'X-API-Key': 'dev-key'
      }
    });

    console.log('Call response:', JSON.stringify(response.data, null, 2));
    
    // If the call was successful, extract and display the call ID
    if (response.data && response.data.call_id) {
      console.log('Call initiated with ID:', response.data.call_id);
      return response.data.call_id;
    } else {
      console.log('Call failed or no call ID returned');
      return null;
    }
  } catch (error) {
    console.error('Error making call:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      console.error('Response status:', error.response.status);
    }
    return null;
  }
}

// Execute the call
makeCall().then(callId => {
  if (callId) {
    console.log(`Call initiated successfully. Call ID: ${callId}`);
    console.log(`Check the Google Sheets log to see the results.`);
  }
}); 