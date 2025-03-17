/**
 * Direct API call to Bland.AI to make a phone call
 */

require('dotenv').config();
const axios = require('axios');

// Task prompt for joke sharing
const TASK_PROMPT = `You're calling to share some jokes with the user. Your goal is to keep them on the phone for at least one minute. Be friendly and engaging, introducing yourself as a comedy enthusiast who wants to brighten their day with a few jokes. Ask them what type of jokes they prefer (puns, dad jokes, etc.) and tailor your jokes to their preference if they give one. If they don't have a preference, start with general crowd-pleasing jokes.

After each joke, briefly pause to give them a chance to laugh or react, then ask if they'd like to hear another one. Keep track of which jokes seem to make them laugh the most. If they're not laughing at certain types of jokes, pivot to a different style. Your tone should be upbeat and enthusiastic, as if you're genuinely enjoying sharing jokes with them.

Continue telling jokes until either: 1) you've been on the call for more than one minute, at which point you can thank them for their time and end the call, or 2) they indicate they want to end the call. Don't mention explicitly that your goal is to keep them on the line for one minute.`;

// Phone number to call
const PHONE_NUMBER = '+12129965776';

// Make API call directly to Bland.AI
async function makeDirectCall() {
  try {
    console.log(`Making direct API call to Bland.AI to call ${PHONE_NUMBER}...`);
    
    const response = await axios.post('https://api.bland.ai/v1/calls', {
      phone_number: PHONE_NUMBER,
      task: TASK_PROMPT,
      voice: 'nat',
      model: 'turbo',
      // Add other parameters as needed
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AILEVELUP_ENTERPRISE_API_KEY}`
      }
    });

    console.log('Call response:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error making API call:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      console.error('Response status:', error.response.status);
    }
    return { error: error.message };
  }
}

// Execute the function
makeDirectCall()
  .then(result => {
    console.log('Call initiated successfully:', result);
    console.log(`Check the call status using the call_id: ${result.call_id}`);
  })
  .catch(error => {
    console.error('Error:', error);
  }); 