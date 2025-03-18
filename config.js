/**
 * Main configuration file for the SendPhoneCallMCP application
 */

require('dotenv').config();

const config = {
  // Node environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Server settings
  PORT: process.env.PORT || 3040,
  
  // Bland AI API settings
  BLAND_API_URL: process.env.BLAND_API_URL || 'https://api.bland.ai',
  BLAND_API_KEY: process.env.BLAND_API_KEY || 'sk_b5fc3f2d547aea14f9211eb0b9b94d662fa65ff61565b625',
  
  // AWS Lambda settings
  LAMBDA_FUNCTION_NAME: process.env.LAMBDA_FUNCTION_NAME || 'ailevelup-phone-call-mcp-staging-make-call',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  
  // Default phone numbers for testing
  DEFAULT_PHONE_NUMBER: '+12129965776',
  DEFAULT_FROM_NUMBER: '+15615665857',
  
  // Google Sheets settings
  GOOGLE_SHEETS_DOC_ID: process.env.GOOGLE_SHEETS_DOC_ID,
  GOOGLE_SHEETS_CLIENT_EMAIL: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  GOOGLE_SHEETS_PRIVATE_KEY: process.env.GOOGLE_SHEETS_PRIVATE_KEY,
  
  // Supabase settings
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  
  // Rate limiting
  RATE_LIMIT: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
  },
  
  // Default phone call settings
  DEFAULT_MODEL: 'turbo',
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_VOICE: 'd9c372fd-31db-4c74-ac5a-d194e8e923a4', // Alloy
  DEFAULT_VOICE_NAME: 'Alloy',
  DEFAULT_VOICEMAIL_ACTION: 'hangup',
  DEFAULT_MAX_DURATION: 300, // 5 minutes
  
  // Feature flags
  ENABLE_VOICE_SAMPLES: true,
  ENABLE_ANSWERED_BY: true,
  ENABLE_CREDITS: true,
  BYPASS_AUTH_IN_DEV: process.env.NODE_ENV !== 'production'
};

module.exports = config; 