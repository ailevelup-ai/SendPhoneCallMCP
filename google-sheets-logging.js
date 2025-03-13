// Google Sheets Logging for Bland.AI MCP Wrapper
const { google } = require('googleapis');
const sheets = google.sheets('v4');
const { default: fetch } = require('node-fetch');
const { supabaseAdmin } = require('./config/supabase');
require('dotenv').config();

const { googleSheetsRateLimiter } = require('./utils/rate-limiter');
const { logger } = require('./utils/logger');
const axios = require('axios');

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
      range: `${SHEET_NAME}!A1:AB1`,
      valueInputOption: 'RAW',
      resource: {
        values: [headers]
      }
    });

    // Format header row and set row height for all rows
    await sheets.spreadsheets.batchUpdate({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [
          // Format header row
          {
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
          },
          // Set row height for all rows to 21 pixels
          {
            updateDimensionProperties: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: 0,
                endIndex: 1000 // Set for a large number of rows
              },
              properties: {
                pixelSize: 21
              },
              fields: 'pixelSize'
            }
          }
        ]
      }
    });

    console.log('Spreadsheet initialized successfully');
  } catch (error) {
    console.error('Error initializing spreadsheet:', error);
    throw error;
  }
}

/**
 * Format the transcripts array into a readable conversation
 */
function formatTranscript(transcripts) {
  if (!transcripts || !Array.isArray(transcripts) || transcripts.length === 0) {
    return '';
  }
  
  // Sort transcripts by timestamp
  const sortedTranscripts = [...transcripts].sort((a, b) => {
    return new Date(a.created_at) - new Date(b.created_at);
  });
  
  // Format into conversation with timestamps
  return sortedTranscripts.map(t => {
    const timestamp = new Date(t.created_at).toLocaleTimeString();
    const speaker = t.user === 'assistant' ? 'Assistant' : 
                   t.user === 'user' ? 'Customer' : 
                   t.user === 'agent-action' ? 'System' : t.user;
    return `[${timestamp}] ${speaker}: ${t.text}`;
  }).join('\n');
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
      callData.from_number || 'N/A',
      billedAmount.toFixed(2),
      '', // Error messages
      '', // Call summary (will be updated by polling function)
      '', // Recording URL (will be updated by polling function)
      '', // Transcript (will be updated by polling function)
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
      range: `${SHEET_NAME}!A1:AB1`,
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
    logger.info(`Updating call ${callId} in Google Sheets at row ${rowIndex}`);
    
    // If rowIndex is 0, we need to find the row for this call ID
    if (rowIndex === 0) {
      rowIndex = await findRowForCallId(callId);
      if (!rowIndex) {
        logger.warn(`Call ID ${callId} not found in Google Sheets`);
        return false;
      }
    }
    
    // Fetch call details from Bland.AI
    logger.info(`Fetching call details from Bland.AI API for call ${callId}`);
    try {
      const response = await axios.get(`https://api.bland.ai/v1/calls/${callId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.BLAND_ENTERPRISE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const callData = response.data;
      
      // Calculate call duration in minutes
      const callDurationMinutes = callData.call_length || 0;
      
      // Calculate billed amount based on actual call duration
      // $0.10 per minute (minimum 1 minute)
      const billedAmount = Math.max(1, callDurationMinutes) * 0.10;

      // Extract additional fields from call data
      const summary = callData.summary || '';
      const recordingUrl = callData.recording_url || '';
      const formattedTranscript = formatTranscript(callData.transcripts || []);
      const concatenatedTranscript = callData.concatenated_transcript || '';
      const transferNumber = callData.to || '';
      const answeredBy = callData.answered_by || '';
      const callEndedBy = callData.call_ended_by || '';
      const analysisSchema = callData.analysis_schema || {};
      const analysis = callData.analysis || {};
      const correctedDuration = callData.corrected_duration || '';
      const errorMessage = callData.error_message || '';
      const callStatus = callData.status || 'completed';
      
      // Get auth client for Google Sheets
      const authClient = await getAuthClient();
      
      // Update the Google Sheet with complete call details
      await sheets.spreadsheets.values.update({
        auth: authClient,
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!F${rowIndex}:AB${rowIndex}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[
            callDurationMinutes.toString(), // F - Call Duration
            callStatus,                     // G - Call Status
            '',                             // H - Credits Used (unchanged)
            '',                             // I - Webhook URL (unchanged)
            '',                             // J - Voice Used (unchanged)
            '',                             // K - Task/Prompt (unchanged)
            '',                             // L - Moderation Status (unchanged)
            '',                             // M - From Number (unchanged)
            billedAmount.toFixed(2),        // N - Billed Amount
            errorMessage,                   // O - Error Messages
            summary,                        // P - Call Summary
            recordingUrl,                   // Q - Recording URL
            formattedTranscript,            // R - Transcript
            '',                             // S - Request Parameters (unchanged)
            '',                             // T - Response Parameters (unchanged)
            concatenatedTranscript,         // U - Concatenated Transcript
            transferNumber,                 // V - Transfer Number
            answeredBy,                     // W - Answered By
            callEndedBy,                    // X - Call Ended By
            JSON.stringify(analysisSchema), // Y - Analysis Schema
            JSON.stringify(analysis),       // Z - Analysis
            correctedDuration,              // AA - Corrected Duration
            'Updated',                      // AB - Update Status
            new Date().toISOString()        // AC - Last Updated
          ]]
        }
      });
      
      // Set row height to 21 pixels for the updated row
      try {
        const { data: spreadsheet } = await sheets.spreadsheets.get({
          auth: authClient,
          spreadsheetId: SPREADSHEET_ID,
          ranges: [],
          includeGridData: false,
        });
        
        let sheetId = null;
        for (const sheet of spreadsheet.sheets) {
          if (sheet.properties.title === SHEET_NAME) {
            sheetId = sheet.properties.sheetId;
            break;
          }
        }
        
        if (sheetId) {
          await sheets.spreadsheets.batchUpdate({
            auth: authClient,
            spreadsheetId: SPREADSHEET_ID,
            resource: {
              requests: [{
                updateDimensionProperties: {
                  range: {
                    sheetId: sheetId,
                    dimension: 'ROWS',
                    startIndex: rowIndex - 1, // Convert to 0-indexed
                    endIndex: rowIndex // End is exclusive
                  },
                  properties: {
                    pixelSize: 21
                  },
                  fields: 'pixelSize'
                }
              }]
            }
          });
        }
      } catch (rowHeightError) {
        logger.warn(`Failed to set row height: ${rowHeightError.message}`);
      }
      
      // Update Supabase with the same data
      try {
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
            transcript: formattedTranscript,
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
      } catch (supabaseError) {
        logger.warn(`Supabase update failed (this is normal if Supabase is not configured): ${supabaseError.message}`);
      }
      
      logger.info(`Successfully updated call ${callId} in Google Sheets`);
      return true;
    } catch (apiError) {
      // Handle Bland.AI API errors
      console.error(`Error fetching call details for ${callId}: ${apiError.message}`);
      
      // Update the row with error
      const authClient = await getAuthClient();
      await sheets.spreadsheets.values.update({
        auth: authClient,
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!O${rowIndex}:AB${rowIndex}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[
            '', // Error Messages (now column O)
            '', // Call summary (now column P)
            '', // Recording URL (now column Q)
            '', // Transcript (now column R)
            '', // Request Parameters (now column S)
            '', // Response Parameters (now column T)
            '', // Concatenated Transcript (now column U)
            '', // Transfer Number (now column V)
            '', // Answered By (now column W)
            '', // Call Ended By (now column X)
            '', // Analysis Schema (now column Y)
            '', // Analysis (now column Z)
            '', // Corrected Duration (now column AA)
            'Error fetching data' // Update Status (now column AB)
          ]]
        }
      });
      
      // Also set row height to 21 pixels even for error rows
      try {
        const { data: spreadsheet } = await sheets.spreadsheets.get({
          auth: authClient,
          spreadsheetId: SPREADSHEET_ID,
          ranges: [],
          includeGridData: false,
        });
        
        let sheetId = null;
        for (const sheet of spreadsheet.sheets) {
          if (sheet.properties.title === SHEET_NAME) {
            sheetId = sheet.properties.sheetId;
            break;
          }
        }
        
        if (sheetId) {
          await sheets.spreadsheets.batchUpdate({
            auth: authClient,
            spreadsheetId: SPREADSHEET_ID,
            resource: {
              requests: [{
                updateDimensionProperties: {
                  range: {
                    sheetId: sheetId,
                    dimension: 'ROWS',
                    startIndex: rowIndex - 1, // Convert to 0-indexed
                    endIndex: rowIndex // End is exclusive
                  },
                  properties: {
                    pixelSize: 21
                  },
                  fields: 'pixelSize'
                }
              }]
            }
          });
        }
      } catch (rowHeightError) {
        logger.warn(`Failed to set row height: ${rowHeightError.message}`);
      }
      
      // Update Supabase as well
      try {
        await supabaseAdmin
          .from('calls')
          .update({
            error_message: `Error fetching call details: ${apiError.message}`,
            update_status: 'Error fetching data',
            last_updated: new Date().toISOString()
          })
          .eq('call_id', callId);
      } catch (supabaseError) {
        logger.warn(`Supabase error update failed: ${supabaseError.message}`);
      }
      
      return false;
    }
  } catch (error) {
    logger.error(`Error updating call ${callId} in Google Sheets:`, error);
    
    // Update Supabase with error status if available
    try {
      await supabaseAdmin
        .from('calls')
        .update({ update_status: 'Error fetching data' })
        .eq('call_id', callId);
    } catch (supabaseError) {
      logger.warn(`Supabase error update failed: ${supabaseError.message}`);
    }
    
    return false;
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
      range: `${SHEET_NAME}!A:AB`,
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
    
    // First, check if the calls table exists
    try {
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
    } catch (dbError) {
      // If the table doesn't exist, create it
      if (dbError.message && (dbError.message.includes('does not exist') || dbError.code === '42703')) {
        console.warn('The calls table might not exist or have the correct schema. This is expected in new deployments.');
        
        // Instead, try to update based on Google Sheets data
        console.log('Falling back to updating based on Google Sheets data...');
        await updateFromGoogleSheets();
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error('Error polling Supabase calls:', error);
  }
}

// Update calls based on Google Sheets data when Supabase table isn't available
async function updateFromGoogleSheets() {
  try {
    const authClient = await getAuthClient();
    
    // Get all rows from the spreadsheet
    const response = await sheets.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:E`,
    });
    
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      console.log('No call data in Google Sheets');
      return;
    }
    
    // Skip header row
    console.log(`Found ${rows.length - 1} call records in Google Sheets`);
    let updatedCount = 0;
    
    // Update only the last 5 calls for performance reasons
    const maxUpdates = 5;
    const startRow = Math.max(1, rows.length - maxUpdates);
    
    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      
      // Get call ID (column 4)
      const callId = row[3];
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
    
    console.log(`Updated ${updatedCount} calls from Google Sheets`);
  } catch (error) {
    console.error('Error updating from Google Sheets:', error);
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
      range: `${SHEET_NAME}!A:AB`,
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

/**
 * Find row index for a call ID in Google Sheets
 * @param {string} callId Call ID to find
 * @returns {Promise<number|null>} Row index (1-based) or null if not found
 */
async function findRowForCallId(callId) {
  try {
    const authClient = await getAuthClient();
    
    // Get all data to find the correct row
    const response = await sheets.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:D`,
    });
    
    const rows = response.data.values || [];
    
    // Look for call ID in column D (index 3)
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][3] === callId) {
        return i + 1; // 1-based row index (header is row 1)
      }
    }
    
    return null; // Call ID not found
  } catch (error) {
    console.error('Error finding row for call ID:', error);
    throw error;
  }
}

// Export the functions
module.exports = {
  initializeSpreadsheet,
  logCallToGoogleSheets,
  generateCallReport,
  pollCallUpdates,
  updateCallInGoogleSheets,
  pollSupabaseCalls,
  findRowForCallId
};
