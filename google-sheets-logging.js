// Google Sheets Logging for Bland.AI MCP Wrapper
const { google } = require('googleapis');
const sheets = google.sheets('v4');
const { default: fetch } = require('node-fetch');
const { supabaseAdmin } = require('./config/supabase');
require('dotenv').config();

const { googleSheetsRateLimiter } = require('./utils/rate-limiter');
const { logger } = require('./utils/logger');

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

/**
 * Log a call to Google Sheets
 * @param {Object} callData Call data to log
 * @returns {Promise<Object>} Call data with rowIndex
 */
async function logCallToGoogleSheets(callData) {
  try {
    // Acquire token for rate limiting
    await googleSheetsRateLimiter.consume(1);

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
    // Check if this is a rate limit error
    if (error.message.includes('Rate limit exceeded')) {
      logger.warn('Google Sheets rate limit exceeded, using fallback logging', {
        callId: callData.call_id
      });
      
      // Use fallback logging method
      return await fallbackLogging(callData, error);
    }
    
    // Other errors
    logger.error(`Error logging call to Google Sheets: ${error.message}`, { error });
    throw error;
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

/**
 * Update a call in Google Sheets
 * @param {string} callId Call ID to update
 * @param {number} rowIndex Row index in the spreadsheet
 * @returns {Promise<Object>} Updated call data
 */
async function updateCallInGoogleSheets(callId, rowIndex) {
  try {
    // Acquire token for rate limiting (this operation costs 2 tokens - 1 for read, 1 for write)
    await googleSheetsRateLimiter.consume(2);

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
      
      // Update Supabase as well
      await supabaseAdmin
        .from('calls')
        .update({
          error_message: `Error fetching call details: ${response.statusText}`,
          update_status: 'Error fetching data',
          last_updated: new Date().toISOString()
        })
        .eq('call_id', callId);
      
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
    const analysisSchema = callData.analysis_schema || {};
    const analysis = callData.analysis || {};
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
          JSON.stringify(analysisSchema), // Analysis Schema
          JSON.stringify(analysis), // Analysis
          correctedDuration, // Corrected Duration
          'Updated', // Update Status
          new Date().toISOString() // Last Updated
        ]]
      }
    });
    
    // Update Supabase with the same data
    const { error: updateError } = await supabaseAdmin
      .from('calls')
      .update({
        status: callStatus,
        duration: callDurationMinutes,
        credits_used: Math.max(1, callDurationMinutes), // Minimum 1 credit
        recording_url: recordingUrl,
        call_summary: summary,
        error_message: errorMessage,
        concatenated_transcript: concatenatedTranscript,
        transfer_number: transferNumber,
        answered_by: answeredBy,
        call_ended_by: callEndedBy,
        analysis_schema: analysisSchema,
        analysis: analysis,
        update_status: 'Updated',
        last_updated: new Date().toISOString()
      })
      .eq('call_id', callId);
    
    if (updateError) {
      console.error(`Error updating call in Supabase: ${updateError.message}`);
    }
    
    console.log(`Successfully updated call ${callId} in Google Sheets and Supabase`);
    return true;
  } catch (error) {
    // Check if this is a rate limit error
    if (error.message.includes('Rate limit exceeded')) {
      logger.warn('Google Sheets rate limit exceeded during update, will retry later', {
        callId,
        rowIndex
      });
      
      // Queue for retry later instead of failing
      queueForRetry('updateCall', { callId, rowIndex });
      return;
    }
    
    // Other errors
    logger.error(`Error updating call in Google Sheets: ${error.message}`, {
      error,
      callId,
      rowIndex
    });
    throw error;
  }
}

/**
 * Poll for call updates
 * @returns {Promise<number>} Number of calls updated
 */
async function pollCallUpdates() {
  try {
    // Get rate limiter stats before operation
    const beforeStats = googleSheetsRateLimiter.getStats();
    
    // Log rate limiter status
    logger.info('Google Sheets rate limiter status before polling', {
      availableTokens: beforeStats.availableTokens,
      usagePercent: beforeStats.usagePercent.toFixed(2) + '%'
    });
    
    // If we're running low on tokens, wait to accumulate more
    if (beforeStats.availableTokens < 10) {
      const waitTime = (10 - beforeStats.availableTokens) / googleSheetsRateLimiter.tokensPerSecond * 1000;
      logger.info(`Waiting ${waitTime.toFixed(0)}ms to accumulate more rate limit tokens`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Acquire token for initial spreadsheet read (higher cost operation)
    await googleSheetsRateLimiter.consume(5);

    // Continue with existing function logic, but split into batches
    console.log('Starting call polling process...');
    const authClient = await getAuthClient();
    
    // Get all rows from the spreadsheet
    const response = await sheets.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:AC`,
    });
    
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      console.log('No call data to update in Google Sheets');
      
      // Also check Supabase for pending calls
      await pollSupabaseCalls();
      
      return 0;
    }
    
    // Skip header row
    let updatedCount = 0;
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
      
      updatedCount++;
      
      // Add slight delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Also check Supabase for any calls that might not be in Google Sheets
    await pollSupabaseCalls();
    
    console.log('Call polling completed');
    
    // Get and log rate limiter stats after operation
    const afterStats = googleSheetsRateLimiter.getStats();
    logger.info('Google Sheets rate limiter status after polling', {
      availableTokens: afterStats.availableTokens,
      usagePercent: afterStats.usagePercent.toFixed(2) + '%',
      requestsTotal: afterStats.requestsTotal,
      requestsDelayed: afterStats.requestsDelayed
    });
    
    // Return result
    return updatedCount;
  } catch (error) {
    // Check if this is a rate limit error
    if (error.message.includes('Rate limit exceeded')) {
      logger.warn('Google Sheets rate limit exceeded during polling, will try again later');
      return 0;
    }
    
    // Other errors
    logger.error(`Error polling call updates: ${error.message}`, { error });
    throw error;
  }
}

// Poll for pending call updates in Supabase
async function pollSupabaseCalls() {
  try {
    console.log('Checking Supabase for pending calls...');
    
    // Get calls with update_status 'Pending' or 'Error fetching data'
    const { data: pendingCalls, error } = await supabaseAdmin
      .from('calls')
      .select('call_id')
      .in('update_status', ['Pending', 'Error fetching data', null])
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('Error fetching pending calls from Supabase:', error);
      return;
    }
    
    console.log(`Found ${pendingCalls.length} pending calls in Supabase`);
    
    for (const call of pendingCalls) {
      // Check if call exists in Google Sheets
      // For Supabase-only updates, we use rowIndex 0 which is a special flag
      await updateCallInGoogleSheets(call.call_id, 0);
      
      // Add slight delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Error polling Supabase calls:', error);
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

/**
 * Queue an operation for retry
 * @param {string} operation Operation name
 * @param {Object} data Operation data
 */
function queueForRetry(operation, data) {
  // Check if retry queue exists or create it
  if (!global.retryQueue) {
    global.retryQueue = [];
  }
  
  // Add to queue with timestamp
  global.retryQueue.push({
    operation,
    data,
    timestamp: Date.now(),
    retryCount: 0
  });
  
  // Start retry process if not already running
  if (!global.retryProcessRunning) {
    processRetryQueue();
  }
}

/**
 * Process the retry queue
 */
async function processRetryQueue() {
  // Set flag to prevent multiple concurrent processing
  global.retryProcessRunning = true;
  
  try {
    // Get rate limiter stats
    const stats = googleSheetsRateLimiter.getStats();
    
    // Only process if we have enough tokens
    if (stats.availableTokens < 10 || global.retryQueue.length === 0) {
      // Try again later
      setTimeout(processRetryQueue, 30000);
      return;
    }
    
    // Process up to 5 items from the queue
    const itemsToProcess = Math.min(5, global.retryQueue.length);
    
    for (let i = 0; i < itemsToProcess; i++) {
      const item = global.retryQueue.shift();
      
      try {
        // Process based on operation type
        switch (item.operation) {
          case 'updateCall':
            await googleSheetsRateLimiter.consume(2);
            await updateCallInGoogleSheets(item.data.callId, item.data.rowIndex);
            break;
            
          // Add other operation types as needed
            
          default:
            logger.warn(`Unknown retry operation: ${item.operation}`);
        }
      } catch (error) {
        // If still hitting rate limits, put back in queue
        if (error.message.includes('Rate limit exceeded')) {
          item.retryCount++;
          
          // If we've retried too many times, log and discard
          if (item.retryCount > 5) {
            logger.error(`Giving up on retrying operation after ${item.retryCount} attempts`, {
              operation: item.operation,
              data: item.data,
              error: error.message
            });
          } else {
            // Put back in queue (at the end)
            global.retryQueue.push(item);
          }
        } else {
          // Log other errors
          logger.error(`Error processing retry queue item: ${error.message}`, {
            operation: item.operation,
            data: item.data,
            error
          });
        }
      }
    }
    
    // If queue still has items, process again after delay
    if (global.retryQueue.length > 0) {
      setTimeout(processRetryQueue, 10000);
    } else {
      global.retryProcessRunning = false;
    }
  } catch (error) {
    logger.error(`Error in retry queue processing: ${error.message}`, { error });
    
    // Reset flag but try again later
    setTimeout(() => {
      global.retryProcessRunning = false;
      processRetryQueue();
    }, 60000);
  }
}

// Export the functions
module.exports = {
  initializeSpreadsheet,
  logCallToGoogleSheets,
  generateCallReport,
  pollCallUpdates,
  updateCallInGoogleSheets,
  pollSupabaseCalls
};
