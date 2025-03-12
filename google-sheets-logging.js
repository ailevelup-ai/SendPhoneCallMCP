// Google Sheets Logging for Bland.AI MCP Wrapper
const { google } = require('googleapis');
const sheets = google.sheets('v4');
require('dotenv').config();

// Configuration from environment variables
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_DOC_ID;
const SHEET_NAME = 'Call_Logs'; // Changed from 'Call Logs' to avoid spaces

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
  
  try {
    // First, check if the sheet exists
    const { data: spreadsheet } = await sheets.spreadsheets.get({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      ranges: [],
      includeGridData: false,
    });

    // Check if our sheet exists
    let sheetExists = false;
    let sheetId = null;
    
    for (const sheet of spreadsheet.sheets) {
      if (sheet.properties.title === SHEET_NAME) {
        sheetExists = true;
        sheetId = sheet.properties.sheetId;
        break;
      }
    }

    // If sheet doesn't exist, create it
    if (!sheetExists) {
      const request = {
        auth: authClient,
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: SHEET_NAME
              }
            }
          }]
        }
      };

      const response = await sheets.spreadsheets.batchUpdate(request);
      sheetId = response.data.replies[0].addSheet.properties.sheetId;
      console.log(`Created new sheet: ${SHEET_NAME}`);
    }

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
      'Response Parameters',
      'Concatenated Transcript',
      'Transfer Number',
      'Answered By',
      'Call Ended By',
      'Analysis Schema',
      'Analysis',
      'Corrected Duration',
      'Update Status',
      'Last Updated'
    ];

    // Update headers
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:AC1`,
      valueInputOption: 'RAW',
      resource: {
        values: [headers]
      }
    });

    // Format header row
    await sheets.spreadsheets.batchUpdate({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [{
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: headers.length
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.8, green: 0.8, blue: 0.8 },
                textFormat: { bold: true }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        }]
      }
    });

    console.log('Spreadsheet initialized successfully');
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
    
    // Calculate billed amount based on credits used
    const billedAmount = (callData.credits_used || 1) * 0.10;
    
    // Prepare log row
    const logRow = [
      new Date().toISOString(),
      callData.api_key ? callData.api_key.slice(-8) : 'N/A',
      callData.user_id || 'N/A',
      callData.call_id || 'N/A',
      callData.phone_number || 'N/A',
      '0', // Call duration will be updated by polling function
      callData.call_status || 'initiated',
      callData.credits_used || '1',
      callData.webhook || 'N/A',
      callData.voice || 'N/A',
      callData.task || '',
      'passed', // Moderation is handled before logging
      callData.model || 'turbo',
      callData.from_number || 'N/A',
      billedAmount.toFixed(2),
      '', // Error messages
      '', // Call summary (will be updated by polling function)
      '', // Recording URL (will be updated by polling function)
      JSON.stringify(callData.request_parameters || {}),
      JSON.stringify(callData.response_parameters || {}),
      '', // Concatenated transcript
      '', // Transfer number
      '', // Answered by
      '', // Call ended by
      '', // Analysis schema
      '', // Analysis
      '', // Corrected duration
      'Pending', // Update status
      new Date().toISOString() // Last updated timestamp
    ];
    
    // Append to spreadsheet
    await sheets.spreadsheets.values.append({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:AC1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [logRow]
      }
    });
    
    console.log(`Successfully logged call ${callData.call_id} to Google Sheets`);
    return true;
  } catch (error) {
    console.error('Error logging to Google Sheets:', error);
    await fallbackLogging(callData, error);
    return false;
  }
}

// Fallback logging when Google Sheets is unavailable
async function fallbackLogging(callData, error) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    call_data: callData,
    error: error.message
  };
  console.error('FALLBACK LOG:', JSON.stringify(logEntry));
}

// Update call data in Google Sheets using Bland.AI API
async function updateCallInGoogleSheets(callId, rowIndex) {
  try {
    const authClient = await getAuthClient();
    
    // Fetch call details from Bland.AI
    const response = await fetch(`https://api.bland.ai/v1/calls/${callId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.BLAND_ENTERPRISE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Error fetching call details for ${callId}: ${response.statusText}`);
      
      // Update the row with error
      await sheets.spreadsheets.values.update({
        auth: authClient,
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!Q${rowIndex}:AB${rowIndex}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[
            '', // Call summary
            '', // Recording URL
            '', // Request Parameters
            '', // Response Parameters
            '', // Concatenated Transcript
            '', // Transfer Number
            '', // Answered By
            '', // Call Ended By
            '', // Analysis Schema
            '', // Analysis
            '', // Corrected Duration
            'Error fetching data', // Update Status
            new Date().toISOString() // Last Updated
          ]]
        }
      });
      
      return false;
    }

    const callData = await response.json();
    
    // Calculate call duration in minutes
    const callDurationMinutes = callData.call_length || 0;
    
    // Calculate billed amount based on actual call duration
    // $0.10 per minute (minimum 1 minute)
    const billedAmount = Math.max(1, callDurationMinutes) * 0.10;

    // Extract additional fields from call data
    const summary = callData.summary || '';
    const recordingUrl = callData.recording_url || '';
    const concatenatedTranscript = callData.concatenated_transcript || '';
    const transferNumber = callData.to || '';
    const answeredBy = callData.answered_by || '';
    const callEndedBy = callData.call_ended_by || '';
    const analysisSchema = JSON.stringify(callData.analysis_schema || {});
    const analysis = JSON.stringify(callData.analysis || {});
    const correctedDuration = callData.corrected_duration || '';
    const errorMessage = callData.error_message || '';
    const callStatus = callData.status || 'completed';
    
    // Update the Google Sheet with complete call details
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!F${rowIndex}:AC${rowIndex}`,
      valueInputOption: 'RAW',
      resource: {
        values: [[
          callDurationMinutes.toString(), // Call Duration
          callStatus, // Call Status
          '', // Credits Used (unchanged)
          '', // Webhook URL (unchanged)
          '', // Voice Used (unchanged)
          '', // Task/Prompt (unchanged)
          '', // Moderation Status (unchanged)
          '', // Model Used (unchanged)
          '', // From Number (unchanged)
          billedAmount.toFixed(2), // Billed Amount
          errorMessage, // Error Messages
          summary, // Call Summary
          recordingUrl, // Recording URL
          '', // Request Parameters (unchanged)
          '', // Response Parameters (unchanged)
          concatenatedTranscript, // Concatenated Transcript
          transferNumber, // Transfer Number
          answeredBy, // Answered By
          callEndedBy, // Call Ended By
          analysisSchema, // Analysis Schema
          analysis, // Analysis
          correctedDuration, // Corrected Duration
          'Updated', // Update Status
          new Date().toISOString() // Last Updated
        ]]
      }
    });
    
    console.log(`Successfully updated call ${callId} in Google Sheets`);
    return true;
  } catch (error) {
    console.error(`Error updating call ${callId} in Google Sheets:`, error);
    return false;
  }
}

// Poll for pending call updates
async function pollCallUpdates() {
  try {
    const authClient = await getAuthClient();
    
    // Get all rows from the spreadsheet
    const response = await sheets.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:AC`,
    });
    
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      console.log('No call data to update');
      return;
    }
    
    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // Column indices (0-based)
      const callIdIndex = 3;
      const updateStatusIndex = 27;
      
      // Check if this row needs updating (status is 'Pending' or empty)
      const updateStatus = row[updateStatusIndex];
      if (updateStatus !== 'Pending' && updateStatus !== 'Error fetching data' && updateStatus !== '') {
        continue;
      }
      
      const callId = row[callIdIndex];
      if (!callId || callId === 'N/A') {
        continue;
      }
      
      // Row index in spreadsheet (1-based, header is row 1)
      const rowIndex = i + 1;
      
      console.log(`Updating call data for ${callId} at row ${rowIndex}`);
      await updateCallInGoogleSheets(callId, rowIndex);
      
      // Add slight delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Error polling for call updates:', error);
  }
}

// Function to generate reports from the spreadsheet data
async function generateCallReport(startDate, endDate, userId = null) {
  try {
    const authClient = await getAuthClient();
    
    // Get all log data
    const response = await sheets.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:AC`,
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
  generateCallReport,
  pollCallUpdates,
  updateCallInGoogleSheets
};
