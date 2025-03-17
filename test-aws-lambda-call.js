/**
 * Script to test making a phone call using the AWS Lambda function directly
 */

require('dotenv').config();
const { exec } = require('child_process');
const AWS = require('aws-sdk');

// Configure AWS SDK
const region = process.env.AWS_REGION || 'us-east-1';
const stage = process.env.AWS_STAGE || 'staging';
const serviceName = 'ailevelup-phone-call-mcp';

// Set AWS credentials from environment variables
AWS.config.update({
  region,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN
});

// Print current AWS credentials
console.log('Checking AWS credentials...');
const sts = new AWS.STS();
sts.getCallerIdentity().promise()
  .then(data => console.log('AWS Identity:', data.Arn))
  .catch(err => console.error('AWS Identity error:', err.message));

// Create Lambda service object
const lambda = new AWS.Lambda();

// Task prompt for joke sharing
const TASK_PROMPT = `You're calling to share some jokes with the user. Your goal is to keep them on the phone for at least one minute. Be friendly and engaging, introducing yourself as a comedy enthusiast who wants to brighten their day with a few jokes. Ask them what type of jokes they prefer (puns, dad jokes, etc.) and tailor your jokes to their preference if they give one. If they don't have a preference, start with general crowd-pleasing jokes.

After each joke, briefly pause to give them a chance to laugh or react, then ask if they'd like to hear another one. Keep track of which jokes seem to make them laugh the most. If they're not laughing at certain types of jokes, pivot to a different style. Your tone should be upbeat and enthusiastic, as if you're genuinely enjoying sharing jokes with them.

Continue telling jokes until either: 1) you've been on the call for more than one minute, at which point you can thank them for their time and end the call, or 2) they indicate they want to end the call. Don't mention explicitly that your goal is to keep them on the line for one minute.`;

// Phone number to call
const PHONE_NUMBER = '+12129965776';

async function makeTestCall() {
  try {
    console.log(`Invoking Lambda function to make a call to ${PHONE_NUMBER}...`);

    // Prepare the payload for the Lambda function
    const payload = {
      body: JSON.stringify({
        phone_number: PHONE_NUMBER,
        task: TASK_PROMPT,
        voice: 'nat',
        model: 'turbo',
        // Use default values for other parameters
      }),
      // Add dummy authorization for testing
      requestContext: {
        authorizer: {
          claims: {
            sub: process.env.TEST_USER_ID || 'test-user-id'
          }
        }
      }
    };

    // Function name follows the pattern: service-stage-function
    const functionName = `${serviceName}-${stage}-make-call`;
    console.log(`Calling Lambda function: ${functionName}`);

    // Invoke Lambda function
    const params = {
      FunctionName: functionName,
      Payload: JSON.stringify(payload),
      InvocationType: 'RequestResponse'
    };

    // Call the Lambda function
    const response = await lambda.invoke(params).promise();
    
    // Parse the response
    const responseData = JSON.parse(response.Payload);
    console.log('Lambda Response:', JSON.stringify(responseData, null, 2));
    
    return responseData;
  } catch (error) {
    console.error('Error invoking Lambda function:', error);
    return { error: error.message };
  }
}

// Execute the function
makeTestCall()
  .then(result => {
    console.log('Call result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  }); 