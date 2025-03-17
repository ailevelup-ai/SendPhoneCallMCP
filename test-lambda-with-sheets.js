/**
 * Test script for the Lambda function
 * 
 * Tests the Lambda function with a proper payload including from_number
 */

const { exec } = require('child_process');

const testLambda = () => {
  // Create a test payload with phone number, task, and explicit from_number
  const payload = {
    body: JSON.stringify({
      phone_number: '+12129965776',
      task: 'This is a test call from the Lambda function. Say hello, introduce yourself as a test call, and hang up after a brief conversation.',
      from_number: '+15615665857',
      voice: 'mike'
    }),
    requestContext: {
      authorizer: {
        claims: {
          sub: 'test-user-123'
        }
      }
    }
  };

  // AWS Lambda invoke command
  const command = `aws lambda invoke --function-name ailevelup-phone-call-mcp-staging-make-call --cli-binary-format raw-in-base64-out --payload '${JSON.stringify(payload)}' --region us-east-1 response.json && cat response.json`;

  console.log('Executing command:\n', command);

  // Execute the command
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
    }
    console.log(`Lambda response: ${stdout}`);
    
    try {
      // Parse response.json if it exists
      const fs = require('fs');
      if (fs.existsSync('response.json')) {
        const response = fs.readFileSync('response.json', 'utf8');
        console.log('Response details:', response);
      }
    } catch (err) {
      console.error('Error parsing response:', err);
    }
  });
};

// Run the test
testLambda(); 