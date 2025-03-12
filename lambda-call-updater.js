// Lambda function to poll for call updates
require('dotenv').config();
const { pollCallUpdates } = require('./google-sheets-logging');

// This is the AWS Lambda handler function
exports.handler = async (event, context) => {
  try {
    console.log('Starting call data polling...');
    await pollCallUpdates();
    console.log('Call data polling completed successfully');
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Call data polling completed successfully' })
    };
  } catch (error) {
    console.error('Error in call data polling:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to poll call data', message: error.message })
    };
  }
}; 