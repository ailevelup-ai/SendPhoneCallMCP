const axios = require('axios');

exports.handler = async (event, context) => {
  console.log('Starting test function');
  console.log('Event:', JSON.stringify(event));
  console.log('Axios version:', axios.VERSION || 'unknown');
  
  // Log environment variables
  console.log('Environment variables:');
  Object.keys(process.env).forEach(key => {
    console.log(`${key}: ${key.includes('KEY') || key.includes('SECRET') ? '[REDACTED]' : process.env[key]}`);
  });
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Test function executed successfully',
      event: event
    })
  };
}; 