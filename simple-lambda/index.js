/**
 * Simplified Lambda function for making calls
 * 
 * This consolidates all necessary code into a single file for easier deployment
 */

const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const axios = require('axios');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Add Google Sheets integration
const sheets = google.sheets('v4');

// Create Supabase client with service key for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Create Supabase client with anon key for public operations
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Add this right after Supabase client initialization
const VOICE_IDS = {}; // This will be populated from the Supabase database

// Function to fetch voice mappings from Supabase
async function fetchVoiceMappings() {
  try {
    const { data, error } = await supabase.from('voices').select('name, voice_id, is_default');
    
    if (error) {
      console.error('Error fetching voice mappings:', error);
      return false;
    }
    
    // Set default voice ID
    const defaultVoice = data.find(voice => voice.is_default);
    if (defaultVoice) {
      VOICE_IDS.default = defaultVoice.voice_id;
    } else {
      VOICE_IDS.default = null; // Don't use hardcoded fallback
    }
    
    // Populate the VOICE_IDS mapping
    data.forEach(voice => {
      VOICE_IDS[voice.name.toLowerCase()] = voice.voice_id;
    });
    
    console.log('Loaded voice mappings from database:', VOICE_IDS);
    return true;
  } catch (error) {
    console.error('Failed to fetch voice mappings:', error);
    return false;
  }
}

// Setup Google Sheets authentication
const setupGoogleAuth = async () => {
  try {
    console.log('Setting up Google auth with workload identity federation');
    
    // Log all available environment variables related to Google auth
    console.log('Google auth environment variables:');
    console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'not set');
    console.log('GOOGLE_AUDIENCE:', process.env.GOOGLE_AUDIENCE || 'not set');
    console.log('GOOGLE_PROJECT_ID:', process.env.GOOGLE_PROJECT_ID || 'not set');
    console.log('GOOGLE_WORKLOAD_POOL_ID:', process.env.GOOGLE_WORKLOAD_POOL_ID || 'not set');
    console.log('GOOGLE_SHEETS_PRIVATE_KEY length:', process.env.GOOGLE_SHEETS_PRIVATE_KEY ? process.env.GOOGLE_SHEETS_PRIVATE_KEY.length : 'not set');
    console.log('GOOGLE_SHEETS_CLIENT_EMAIL:', process.env.GOOGLE_SHEETS_CLIENT_EMAIL || 'not set');
    console.log('GOOGLE_SHEETS_DOC_ID:', process.env.GOOGLE_SHEETS_DOC_ID || 'not set');
    
    // Check if JWT authentication is possible with the private key
    if (process.env.GOOGLE_SHEETS_PRIVATE_KEY && process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
      console.log('Using JWT authentication with client email:', 
        process.env.GOOGLE_SHEETS_CLIENT_EMAIL);
      
      // Fix any potential issues with the private key formatting
      const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n');
      console.log('Private key properly formatted');
      
      // Create JWT client for authentication
      try {
        const jwtClient = new google.auth.JWT(
          process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
          null,
          privateKey,
          ['https://www.googleapis.com/auth/spreadsheets']
        );
        
        console.log('JWT client created, attempting to authorize...');
        await jwtClient.authorize();
        console.log('Successfully authorized JWT client');
        return jwtClient;
      } catch (authError) {
        console.error('Failed to authorize JWT client:', authError);
        console.error('Error details:', JSON.stringify(authError, null, 2));
        // Try with a different approach if JWT fails
        throw new Error(`JWT authentication failed: ${authError.message}`);
      }
    }
    // Fall back to workload identity if JWT fails or is not available
    else if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_AUDIENCE) {
      console.log('Using workload identity federation with service account:', 
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
      
      // Create auth client using workload identity federation
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        projectId: process.env.GOOGLE_PROJECT_ID,
        clientOptions: {
          clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          universeDomain: 'googleapis.com',
        }
      });
      
      // Verify auth worked by getting client
      try {
        const client = await auth.getClient();
        console.log('Successfully created auth client');
        return auth;
      } catch (clientError) {
        console.error('Failed to create auth client:', clientError);
        throw new Error(`Workload identity federation auth failed: ${clientError.message}`);
      }
    } else {
      const missingVars = [];
      if (!process.env.GOOGLE_SHEETS_PRIVATE_KEY) missingVars.push('GOOGLE_SHEETS_PRIVATE_KEY');
      if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL) missingVars.push('GOOGLE_SHEETS_CLIENT_EMAIL');
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) missingVars.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
      if (!process.env.GOOGLE_AUDIENCE) missingVars.push('GOOGLE_AUDIENCE');
      
      const errorMsg = `Missing required Google auth variables: ${missingVars.join(', ')}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  } catch (error) {
    console.error('Error setting up Google Auth:', error);
    console.error('Stack trace:', error.stack);
    return null;
  }
};

// Helper functions
const createResponse = (statusCode, body) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body: JSON.stringify(body)
  };
};

const getRateLimit = async (userId) => {
  return { allowed: true, resetTime: null };
};

const updateRateLimit = async (userId) => {
  return true;
};

const moderateContent = async (content) => {
  return { isAllowed: true, reason: null };
};

const logCallToGoogleSheets = async (data) => {
  try {
    console.log('Logging call to Google Sheets, data:', JSON.stringify(data));
    
    // First check if spreadsheet ID is set
    const spreadsheetId = process.env.GOOGLE_SHEETS_DOC_ID;
    if (!spreadsheetId) {
      console.error('No spreadsheet ID found in environment variables');
      return false;
    }
    
    console.log('Using spreadsheet ID:', spreadsheetId);
    
    // Then set up authentication
    console.log('Setting up Google Auth for sheets logging...');
    const auth = await setupGoogleAuth();
    if (!auth) {
      console.error('Failed to set up Google Auth, cannot log to sheets');
      return false;
    }
    console.log('Successfully set up Google Auth');
    
    // Format data for Google Sheets - match the column order from the spreadsheet
    const values = [
      [
        new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
        'N/A', // API Key
        data.user_id || 'N/A',
        data.call_id || 'N/A',
        data.phone_number || 'N/A',
        '0', // Call Duration starts at 0
        data.status || 'initiated',
        data.credits_used || '1',
        data.webhook_url || 'N/A',
        data.voice_name || data.voice || process.env.DEFAULT_VOICE || 'N/A', // Use voice_name if available
        data.task ? (data.task.length > 500 ? data.task.substring(0, 500) + '...' : data.task) : '',
        'N/A', // Moderation Status
        data.from || process.env.DEFAULT_FROM_NUMBER || 'N/A',
        '0', // Billed Amount
        data.error_message || '', // Error Messages
        '', // Call Summary
        '', // Recording URL
        '', // Request Parameters
        '', // Response Parameters
        '', // Concatenated Transcript
        '', // Transfer Number
        data.answered_by_enabled ? 'true' : 'false', // Answered By
        '', // Call Ended By
        '', // Analysis Score/Analysis
        'Pending', // Computed Durs Update Status
        new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }) // Last Updated
      ]
    ];
    
    console.log('Appending values to spreadsheet:', JSON.stringify(values));
    
    // Use try/catch specifically for the sheets API call
    try {
      console.log('Creating sheets client...');
      const sheetsClient = sheets.spreadsheets.values;
      console.log('Sheets client created');
      
      // First test if we can access the spreadsheet
      try {
        console.log('Testing if spreadsheet is accessible...');
        
        // First, check if the spreadsheet itself exists and is accessible
        try {
          const spreadsheetResponse = await sheets.spreadsheets.get({
            auth,
            spreadsheetId
          });
          console.log('Spreadsheet is accessible');
          
          // Check if "Call_Logs" sheet exists
          const sheetsInSpreadsheet = spreadsheetResponse.data.sheets.map(sheet => sheet.properties.title);
          console.log('Sheets in spreadsheet:', sheetsInSpreadsheet);
          
          if (!sheetsInSpreadsheet.includes('Call_Logs')) {
            console.log('Call_Logs sheet does not exist, creating it...');
            // Create the Call_Logs sheet
            await sheets.spreadsheets.batchUpdate({
              auth,
              spreadsheetId,
              resource: {
                requests: [
                  {
                    addSheet: {
                      properties: {
                        title: 'Call_Logs'
                      }
                    }
                  }
                ]
              }
            });
            console.log('Call_Logs sheet created successfully');
            
            // Add headers to the sheet
            await sheetsClient.update({
              auth,
              spreadsheetId,
              range: 'Call_Logs!A1:Z1',
              valueInputOption: 'RAW',
              resource: {
                values: [['Timestamp', 'API Key (use #)', 'User ID', 'Call ID', 'Phone Number', 'Call Duration (mins)', 'Call Status', 'Credits Used', 'Webhook URL', 'Voice Used', 'Task/Prompt', 'Moderation Status', 'From Number', 'Billed Amount', 'Error Messages', 'Call Summary', 'Recording URL', 'Request Parameters', 'Response Parameters', 'Concatenated Transcript', 'Transfer Number', 'Answered By', 'Call Ended By', 'Analysis Score/Analysis', 'Computed Durs Update Status', 'Last Updated']]
              }
            });
            console.log('Headers added to Call_Logs sheet');
          }
        } catch (spreadsheetError) {
          console.error('Error checking/creating spreadsheet:', spreadsheetError);
          if (spreadsheetError.code === 403) {
            console.error('Permission denied. Verify that the service account has access to the spreadsheet.');
          } else if (spreadsheetError.code === 404) {
            console.error('Spreadsheet not found. Verify the spreadsheet ID is correct.');
          }
          throw spreadsheetError;
        }
        
        // Try to access the Call_Logs sheet
        const testResponse = await sheetsClient.get({
          auth,
          spreadsheetId,
          range: 'Call_Logs!A1:Z1'
        });
        console.log('Call_Logs sheet is accessible:', JSON.stringify(testResponse.data));
      } catch (testError) {
        console.error('Error accessing spreadsheet:', testError);
        if (testError.code === 403) {
          console.error('Permission denied. Verify that the service account has access to the spreadsheet.');
        } else if (testError.code === 404) {
          console.error('Spreadsheet not found. Verify the spreadsheet ID is correct.');
        } else {
          console.error(`Other error (${testError.code}): ${testError.message}`);
        }
        return false;
      }
      
      // Update Google Sheet
      console.log('Appending data to spreadsheet...');
      const response = await sheetsClient.append({
        auth,
        spreadsheetId,
        range: 'Call_Logs!A:Z',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values
        }
      });
      
      console.log('Google Sheets update response:', JSON.stringify(response.data));
      return true;
    } catch (sheetsError) {
      console.error('Google Sheets API error:', sheetsError);
      console.error('Error stack:', sheetsError.stack);
      
      // Check if it's a permission issue
      if (sheetsError.code === 403) {
        console.error('Permission denied. Verify that the service account has access to the spreadsheet.');
      } else if (sheetsError.code === 404) {
        console.error('Spreadsheet not found. Verify the spreadsheet ID is correct.');
      }
      
      // Log detailed error information
      if (sheetsError.response) {
        console.error('Error response:', JSON.stringify(sheetsError.response.data));
      }
      
      console.error('Error details:', sheetsError.errors || sheetsError.message);
      return false;
    }
  } catch (error) {
    console.error('Error in logCallToGoogleSheets:', error);
    console.error('Stack trace:', error.stack);
    return false;
  }
};

const lambdaWrapper = (handler) => {
  return async (event, context) => {
    try {
      return await handler(event, context);
    } catch (error) {
      console.error('Lambda error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal server error' })
      };
    }
  };
};

// Main handler function
const _makeCallHandler = async (event, context) => {
  try {
    console.log('Received event:', JSON.stringify(event));
    
    // Check for required environment variables
    if (!process.env.AILEVELUP_ENTERPRISE_API_KEY) {
      console.error('Missing required environment variable: AILEVELUP_ENTERPRISE_API_KEY');
    }
    
    if (!process.env.AILEVELUP_ENCRYPTED_KEY) {
      console.error('Missing required environment variable: AILEVELUP_ENCRYPTED_KEY');
    }
    
    if (!process.env.AILEVELUP_API_URL) {
      console.error('Missing required environment variable: AILEVELUP_API_URL');
    }
    
    // Wait for voice mappings to be loaded
    await fetchVoiceMappings();
    
    // Parse the body data from the event
    let body;
    try {
      body = event.body ? JSON.parse(event.body) : {};
      console.log('Parsed body:', JSON.stringify(body));
    } catch (parseError) {
      console.error('Error parsing event body:', parseError);
      console.log('Raw event body:', event.body);
      body = {};
    }
    
    // Check if authorizer exists, otherwise use a default user ID
    let userId;
    if (event.requestContext && event.requestContext.authorizer && event.requestContext.authorizer.claims) {
      userId = event.requestContext.authorizer.claims.sub;
    } else {
      userId = 'test-user-id'; // Default user ID for direct invocations
      console.log('No authorizer found, using default test user ID');
    }
    
    console.log('User ID:', userId);
    console.log('Request body:', JSON.stringify(body));

    // Check rate limit
    const rateLimitResult = await getRateLimit(userId);
    if (!rateLimitResult.allowed) {
      return createResponse(429, {
        error: 'Rate limit exceeded',
        resetTime: rateLimitResult.resetTime
      });
    }

    // Use the specified test numbers if this is a test user
    const isTestUser = userId === 'test-user-id' || userId.includes('test') || userId === process.env.TEST_USER_ID;
    
    // Extract parameters from the request body with defaults for test calls
    const {
      phone_number: requestedPhoneNumber,
      task = "This is a test call from AWS Lambda",
      voice = process.env.DEFAULT_VOICE,
      webhook_url,
      from_number: requestedFromNumber,
      model: requestModel, // Rename to requestModel to preserve the original value but not use it
      temperature = parseFloat(process.env.DEFAULT_TEMPERATURE) || 1,
      voicemail_action = process.env.DEFAULT_VOICEMAIL_ACTION || 'hangup',
      answered_by_enabled = process.env.ANSWERED_BY_ENABLED === 'true',
      max_duration
    } = body;
    
    // Use the specific phone numbers for testing or the ones from the request
    const phone_number = isTestUser ? (requestedPhoneNumber || "+12129965776") : requestedPhoneNumber;
    const from_number = isTestUser ? (requestedFromNumber || "+15615665857") : requestedFromNumber;

    // Always use "turbo" model
    const model = "turbo";

    // Handle voice ID mapping
    let voiceId;
    let voiceName = voice || 'default'; // Store the original voice name
    
    if (voice) {
      // Convert to lowercase for case-insensitive matching
      const voiceNameLower = voice.toLowerCase();
      
      // Check if we have this voice in our mapping
      if (VOICE_IDS[voiceNameLower]) {
        voiceId = VOICE_IDS[voiceNameLower];
        console.log(`Mapped voice name "${voice}" to ID "${voiceId}"`);
      } else if (voice.startsWith('11labs-')) {
        // If it's already a voice ID, use it directly
        voiceId = voice;
        console.log(`Using provided voice ID: ${voiceId}`);
      } else {
        // Use default voice if name not found
        voiceId = VOICE_IDS.default;
        voiceName = 'default'; // Reset voice name to default
        console.log(`Voice name "${voice}" not found, using default: ${voiceId}`);
      }
    } else {
      // No voice specified, use default
      voiceId = VOICE_IDS.default;
      voiceName = 'default'; // Set voice name to default
      console.log(`No voice specified, using default: ${voiceId}`);
    }

    // Ensure from_number is explicitly set 
    const fromNumber = from_number || process.env.DEFAULT_FROM_NUMBER;
    console.log('Using from number:', fromNumber);
    console.log('Using phone number:', phone_number);
    console.log('Encrypted key:', process.env.AILEVELUP_ENCRYPTED_KEY);

    // Validate required fields
    if (!phone_number || !task) {
      return createResponse(400, {
        error: 'Missing required fields',
        required: ['phone_number', 'task']
      });
    }

    let userCredits = { balance: 10 }; // Default credits for testing
    
    // For non-test users, check credits in the database
    if (userId !== 'test-user-id' && !userId.includes('test') && userId !== process.env.TEST_USER_ID) {
      // Check user credits
      const { data, error } = await supabase
        .from('credits')
        .select('balance')
        .eq('user_id', userId)
        .single();
        
      if (error) {
        console.error('Error checking credits:', error);
      }
      
      if (data) {
        userCredits = data;
      }
      
      // Verify sufficient credits
      if (!data || data.balance < 1) {
        return createResponse(402, {
          error: 'Insufficient credits',
          credits: data?.balance || 0
        });
      }
    } else {
      console.log('Using test user account - bypassing credits check');
    }

    // Moderate content
    const moderationResult = await moderateContent(task);
    if (!moderationResult.isAllowed) {
      return createResponse(400, {
        error: 'Content moderation failed',
        reason: moderationResult.reason
      });
    }

    console.log('Making API call to:', `${process.env.AILEVELUP_API_URL}/v1/calls`);
    
    // Prepare the API request payload
    const apiPayload = {
      phone_number,
      task,
      voice_id: voiceId,
      from: fromNumber,
      webhook_url,
      model: "turbo",
      temperature,
      voicemail_action,
      answered_by_enabled,
      max_duration: max_duration || userCredits.balance,
      local_dialing: false
    };
    
    console.log('API Payload:', JSON.stringify(apiPayload));
    
    // Define the URL and headers
    const API_URL = process.env.AILEVELUP_API_URL;
    console.log('Using API URL:', API_URL);
    
    // Set up headers for API request
    const headers = {
      'Content-Type': 'application/json',
      'authorization': process.env.AILEVELUP_ENTERPRISE_API_KEY,
      'encrypted-key': process.env.AILEVELUP_ENCRYPTED_KEY
    };
    
    console.log('API headers:', JSON.stringify({
      'Content-Type': 'application/json',
      'authorization': process.env.AILEVELUP_ENTERPRISE_API_KEY ? 'Set (value hidden)' : 'Not set',
      'encrypted-key': process.env.AILEVELUP_ENCRYPTED_KEY ? 'Set (value hidden)' : 'Not set'
    }));
    
    // Define callData variable in the outer scope
    let callData;
    
    // Use axios instead of fetch
    try {
      console.log('Making API call with payload:', JSON.stringify(apiPayload));
      
      const response = await axios({
        method: 'post',
        url: `${API_URL}/v1/calls`,
        headers: headers,
        data: apiPayload
      });

      callData = response.data;
      console.log('API Response status:', response.status);
      console.log('API Response headers:', JSON.stringify(response.headers));
      console.log('API Response data:', JSON.stringify(callData));

      if (response.status < 200 || response.status >= 300) {
        console.error('API call returned non-success status code:', response.status);
        return createResponse(response.status, {
          error: 'Failed to make call',
          details: callData
        });
      }
    } catch (apiError) {
      console.error('API call error:', apiError.message);
      console.error('API call error stack:', apiError.stack);
      if (apiError.response) {
        console.error('API response status:', apiError.response.status);
        console.error('API response headers:', JSON.stringify(apiError.response.headers));
        console.error('API response data:', JSON.stringify(apiError.response.data));
      } else if (apiError.request) {
        console.error('API request was made but no response received:', apiError.request);
      } else {
        console.error('API error setup details:', apiError.message);
      }
      
      // Add error info to Google Sheets log
      await logCallToGoogleSheets({
        user_id: userId,
        call_id: 'error',
        phone_number,
        status: 'error',
        task,
        voice: voiceId,
        voice_name: voiceName,
        from: fromNumber,
        credits_used: 0,
        webhook_url,
        error_message: apiError.message
      });
      
      return createResponse(500, {
        error: 'API call failed',
        message: apiError.message,
        details: apiError.response ? apiError.response.data : null
      });
    }

    // For real users, update database
    if (userId !== 'test-user-id' && !userId.includes('test') && userId !== process.env.TEST_USER_ID) {
      // Log call to database
      const { data: call, error: dbError } = await supabase
        .from('calls')
        .insert({
          user_id: userId,
          call_id: callData.call_id,
          phone_number,
          status: 'initiated',
          task,
          voice: voiceId,
          from: fromNumber,
          model: "turbo",
          temperature,
          voicemail_action,
          answered_by_enabled,
          max_duration: max_duration || userCredits.balance,
          credits_used: 1,
          update_status: 'Pending'
        })
        .select()
        .single();

      if (dbError) {
        console.error('Error logging call to database:', dbError);
      }

      // Deduct credits
      await supabase
        .from('credits')
        .update({
          balance: userCredits.balance - 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    } else {
      console.log('Test user - skipping database updates');
    }

    // Log to Google Sheets - make sure to include all needed fields
    const sheetsLogged = await logCallToGoogleSheets({
      user_id: userId,
      call_id: callData.call_id,
      phone_number,
      status: 'initiated',
      task,
      voice: voiceId,
      voice_name: voiceName,
      from: fromNumber,
      model: "turbo",
      temperature,
      voicemail_action,
      answered_by_enabled,
      max_duration: max_duration || userCredits.balance,
      credits_used: 1
    });
    
    console.log('Call logged to Google Sheets:', sheetsLogged);

    // Update rate limit
    await updateRateLimit(userId);

    return createResponse(200, {
      success: true,
      call_id: callData.call_id,
      status: 'initiated',
      credits_remaining: userCredits.balance - 1,
      sheets_logged: sheetsLogged,
      ...callData
    });
  } catch (error) {
    console.error('Error making call:', error);
    return createResponse(500, {
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Export the handler function
exports.handler = lambdaWrapper(_makeCallHandler); 