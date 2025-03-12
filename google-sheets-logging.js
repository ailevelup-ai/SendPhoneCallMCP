// Google Sheets Logging for Bland.AI MCP Wrapper
const { google } = require('googleapis');
const sheets = google.sheets('v4');
require('dotenv').config();

// Configuration from environment variables
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_DOC_ID;
const SHEET_NAME = 'Call Logs';

// Google Sheets authentication using environment variables
async function getAuthClient() {
  try {
    // The private key might have escaped newlines (\n) that need to be converted
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n');
    
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    
    await auth.authorize();
    return auth;
  } catch (error) {
    console.error('Error authenticating with Google:', error);
    throw new Error(`Google Sheets authentication failed: ${error.message}`);
  }
}

// Initialize the spreadsheet with headers if needed
async function initializeSpreadsheet() {
  const authClient = await getAuthClient();
  
  // Define column headers
  const headers = [
    'Timestamp',
    'API Key (Last 8)',
    'User ID',
    'Call ID',
    'Phone Number',
    'Call Duration (min)',
    'Call Status',
    'Credits Used',
    'Webhook URL',
    'Voice Used',
    'Task/Prompt',
    'Moderation Status',
    'Model Used',
    'From Number',
    'Billed Amount',
    'Error Messages',
    'Call Summary',
    'Recording URL',
    'Request Parameters',
    'Response Parameters'
  ];
  
  // Check if sheet exists and has headers
  try {
    const response = await sheets.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:T1`,
    });
    
    // If no headers or wrong headers, set them
    if (!response.data.values || response.data.values[0].join(',') !== headers.join(',')) {
      await sheets.spreadsheets.values.update({
        auth: authClient,
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:T1`,
        valueInputOption: 'RAW',
        resource: {
          values: [headers],
        },
      });
      
      // Format header row
      await sheets.spreadsheets.batchUpdate({
        auth: authClient,
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: 0, // Assumes first sheet
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: headers.length,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: {
                      red: 0.8,
                      green: 0.8,
                      blue: 0.8,
                    },
                    textFormat: {
                      bold: true,
                    },
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)',
              },
            },
          ],
        },
      });
      
      console.log('Initialized Google Sheets with headers');
    }
  } catch (error) {
    console.error('Error initializing spreadsheet:', error);
    throw error;
  }
}

// Main logging function
async function logCallToGoogleSheets(callData) {
  try {
    // Check if required environment variables are set
    if (!process.env.GOOGLE_SHEETS_DOC_ID || 
        !process.env.GOOGLE_SHEETS_PRIVATE_KEY || 
        !process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
      console.error('Google Sheets credentials not found in environment variables');
      return false;
    }
    
    const authClient = await getAuthClient();
    
    // Calculate billed amount based on call duration
    const billedAmount = callData.call_duration ? (callData.call_duration * 0.10).toFixed(2) : '0.00';
    
    // Prepare log row
    const logRow = [
      new Date().toISOString(), // Timestamp
      callData.api_key ? callData.api_key.slice(-8) : 'N/A', // Last 8 chars of API key
      callData.user_id || 'N/A',
      callData.call_id || 'N/A',
      callData.phone_number || 'N/A', // Full, unmasked phone number
      callData.call_duration || '0',
      callData.call_status || 'N/A',
      billedAmount, // Credits used (same as billed amount for now)
      callData.webhook || 'N/A',
      callData.voice || 'N/A',
      callData.task || '', // Full task/prompt
      callData.moderation_status || 'N/A',
      callData.model || 'N/A',
      callData.from || 'N/A', // Full from number
      billedAmount,
      callData.error_message || '',
      callData.summary || '',
      callData.recording_url || '',
      JSON.stringify(callData.request_parameters || {}),
      JSON.stringify(callData.response_parameters || {})
    ];
    
    // Append to spreadsheet
    await sheets.spreadsheets.values.append({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:T1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [logRow],
      },
    });
    
    console.log(`Successfully logged call ${callData.call_id} to Google Sheets`);
    return true;
  } catch (error) {
    console.error('Error logging to Google Sheets:', error);
    
    // Implement fallback logging (e.g., to a local file or database)
    await fallbackLogging(callData, error);
    return false;
  }
}

// Fallback logging when Google Sheets is unavailable
async function fallbackLogging(callData, error) {
  // Log to local file or database
  const logEntry = {
    timestamp: new Date().toISOString(),
    call_data: callData,
    error: error.message,
  };
  
  // This could write to a local file or database
  console.error('FALLBACK LOG:', JSON.stringify(logEntry));
  
  // You could implement a retry mechanism or queue here
}

// Function to generate reports from the spreadsheet data
async function generateCallReport(startDate, endDate, userId = null) {
  try {
    const authClient = await getAuthClient();
    
    // Get all log data
    const response = await sheets.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:T`,
    });
    
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return { error: 'No data available for report' };
    }
    
    // Extract headers and data
    const headers = rows[0];
    const data = rows.slice(1);
    
    // Filter by date range and user ID if provided
    const filteredData = data.filter(row => {
      const timestamp = new Date(row[0]);
      const rowUserId = row[2];
      
      const isInDateRange = (!startDate || timestamp >= new Date(startDate)) && 
                            (!endDate || timestamp <= new Date(endDate));
      const isMatchingUser = !userId || rowUserId === userId;
      
      return isInDateRange && isMatchingUser;
    });
    
    // Calculate summary statistics
    const totalCalls = filteredData.length;
    const totalMinutes = filteredData.reduce((sum, row) => sum + (parseFloat(row[5]) || 0), 0);
    const totalBilled = filteredData.reduce((sum, row) => sum + (parseFloat(row[14]) || 0), 0);
    const callsGroupedByStatus = filteredData.reduce((acc, row) => {
      const status = row[6] || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    return {
      totalCalls,
      totalMinutes,
      totalBilled,
      callsGroupedByStatus,
      dateRange: { startDate, endDate },
      userId
    };
  } catch (error) {
    console.error('Error generating call report:', error);
    return { error: error.message };
  }
}

// Export the functions
module.exports = {
  initializeSpreadsheet,
  logCallToGoogleSheets,
  generateCallReport
};
