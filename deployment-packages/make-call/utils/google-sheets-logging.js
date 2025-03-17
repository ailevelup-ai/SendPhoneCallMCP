/**
 * Google Sheets Logging
 * 
 * This module provides functions for logging call data to Google Sheets
 * with rate limiting and batch processing support.
 */

const { logger } = require('./logger');
const { sheets } = require('../config/google');
const { googleSheetsRateLimiter } = require('./rate-limiter');
const { addToBatch, flushAllBatches } = require('./google-sheets-batch');

// Queue for retrying operations
const retryQueue = [];
const MAX_RETRY_COUNT = 3;
const RETRY_BATCH_SIZE = 5;
let isProcessingRetryQueue = false;

/**
 * Log a new call to Google Sheets
 * @param {Object} callData Call data to log
 * @param {boolean} isBatchable Whether this operation can be batched (default: true)
 * @returns {Promise<Object>} Result of the logging operation
 */
async function logCallToGoogleSheets(callData, isBatchable = true) {
  try {
    // Format call data for Google Sheets
    const timestamp = new Date().toISOString();
    const rowData = [
      callData.call_id || '',
      callData.user_id || '',
      callData.phone_number || '',
      callData.status || 'pending',
      callData.task || '',
      callData.voice || '',
      callData.model || '',
      callData.temperature || '',
      callData.voicemail_action || '',
      callData.from_number || '',
      timestamp, // created_at
      timestamp, // updated_at
      '',        // duration
      '',        // transcript
      '',        // recording_url
      '',        // cost
      callData.credits_used || ''
    ];

    logger.debug('Preparing to log call to Google Sheets', {
      callId: callData.call_id,
      isBatchable
    });

    // Check if we should batch this operation
    if (isBatchable) {
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const batchData = {
        tab: 'Calls', // Sheet tab name
        values: [rowData],
        isBatchable: true
      };

      // Try to add to batch, if successful we're done
      const addedToBatch = await addToBatch(sheetId, 'append', batchData);
      if (addedToBatch) {
        logger.debug('Call log added to batch', {
          callId: callData.call_id
        });
        return { success: true, batched: true };
      }
    }

    // If not batched or batching failed, try direct API call with rate limiting
    logger.debug('Executing direct call log to Google Sheets', {
      callId: callData.call_id
    });

    // Acquire a token for this operation
    await googleSheetsRateLimiter.acquireTokens(1);

    // Execute the API call
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Calls!A:Q',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [rowData]
      }
    });

    logger.info('Successfully logged call to Google Sheets', {
      callId: callData.call_id,
      updatedRange: response.data.updates.updatedRange
    });

    return { success: true, response: response.data };
  } catch (error) {
    logger.error(`Error logging call to Google Sheets: ${error.message}`, {
      callId: callData.call_id,
      error
    });

    // Check if error is related to rate limiting
    if (error.code === 429 || (error.response && error.response.status === 429)) {
      logger.warn('Rate limit error when logging call, will retry later', {
        callId: callData.call_id
      });

      // Queue for retry
      queueForRetry({
        type: 'logCall',
        data: callData,
        retryCount: 0
      });

      return { success: false, retrying: true, error: error.message };
    }

    return { success: false, error: error.message };
  }
}

/**
 * Update an existing call in Google Sheets
 * @param {Object} callData Call data to update
 * @param {boolean} isBatchable Whether this operation can be batched (default: true)
 * @returns {Promise<Object>} Result of the update operation
 */
async function updateCallInGoogleSheets(callData, isBatchable = true) {
  try {
    if (!callData.call_id) {
      throw new Error('call_id is required for updating a call');
    }

    // First, find the row with this call_id
    // This always consumes a token (read)
    await googleSheetsRateLimiter.acquireTokens(1);

    const findResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Calls!A:A',
      majorDimension: 'COLUMNS'
    });

    if (!findResponse.data.values || !findResponse.data.values[0]) {
      logger.warn('No calls found in Google Sheet', {
        callId: callData.call_id
      });
      return { success: false, error: 'No calls found in Google Sheet' };
    }

    const callIds = findResponse.data.values[0];
    const rowIndex = callIds.findIndex(id => id === callData.call_id);

    if (rowIndex === -1) {
      logger.warn(`Call ID ${callData.call_id} not found in Google Sheet`);
      return { success: false, error: `Call ID ${callData.call_id} not found in Google Sheet` };
    }

    // Row index is 0-based in our array but 1-based in Google Sheets
    const sheetRowIndex = rowIndex + 1;

    // Prepare update values (only update fields that have values)
    const updateValues = [];

    // Add status if provided
    if (callData.status) {
      updateValues.push({
        range: `Calls!D${sheetRowIndex}`,
        values: [[callData.status]]
      });
    }

    // Add updated_at timestamp
    const timestamp = new Date().toISOString();
    updateValues.push({
      range: `Calls!L${sheetRowIndex}`,
      values: [[timestamp]]
    });

    // Add duration if provided
    if (callData.duration !== undefined) {
      updateValues.push({
        range: `Calls!M${sheetRowIndex}`,
        values: [[callData.duration]]
      });
    }

    // Add transcript if provided
    if (callData.transcript) {
      updateValues.push({
        range: `Calls!N${sheetRowIndex}`,
        values: [[callData.transcript]]
      });
    }

    // Add recording_url if provided
    if (callData.recording_url) {
      updateValues.push({
        range: `Calls!O${sheetRowIndex}`,
        values: [[callData.recording_url]]
      });
    }

    // Add cost if provided
    if (callData.cost !== undefined) {
      updateValues.push({
        range: `Calls!P${sheetRowIndex}`,
        values: [[callData.cost]]
      });
    }

    // Add credits_used if provided
    if (callData.credits_used !== undefined) {
      updateValues.push({
        range: `Calls!Q${sheetRowIndex}`,
        values: [[callData.credits_used]]
      });
    }

    // If no fields to update, return early
    if (updateValues.length === 0) {
      logger.debug('No fields to update for call', {
        callId: callData.call_id
      });
      return { success: true, noChanges: true };
    }

    logger.debug(`Preparing to update call in Google Sheets (row ${sheetRowIndex})`, {
      callId: callData.call_id,
      fieldsToUpdate: updateValues.length,
      isBatchable
    });

    // Try batch operation if applicable
    if (isBatchable) {
      const sheetId = process.env.GOOGLE_SHEET_ID;
      
      // Process each update in the batch
      let batchSuccess = true;
      
      for (const update of updateValues) {
        const range = update.range.split('!')[1]; // Extract just the cell reference
        const tabName = 'Calls';
        
        const batchData = {
          tab: tabName,
          range: range,
          rowIndex: 0, // For a single cell update, rowIndex is always 0
          values: update.values,
          isBatchable: true
        };
        
        // Try to add to batch
        try {
          const addedToBatch = await addToBatch(sheetId, 'update', batchData);
          if (!addedToBatch) {
            batchSuccess = false;
            break;
          }
        } catch (error) {
          logger.error(`Error adding update to batch: ${error.message}`, {
            callId: callData.call_id,
            range: update.range,
            error
          });
          batchSuccess = false;
          break;
        }
      }
      
      if (batchSuccess) {
        logger.debug('Call update added to batch', {
          callId: callData.call_id,
          updatesCount: updateValues.length
        });
        return { success: true, batched: true };
      }
    }

    // If not batched or batching failed, do direct API call

    // Acquire another token for the update operation
    await googleSheetsRateLimiter.acquireTokens(1);

    // Execute batchUpdate
    const batchUpdateBody = {
      data: updateValues.map(update => ({
        range: update.range,
        values: update.values
      })),
      valueInputOption: 'USER_ENTERED'
    };

    const response = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      resource: batchUpdateBody
    });

    logger.info('Successfully updated call in Google Sheets', {
      callId: callData.call_id,
      updatedCount: response.data.totalUpdatedCells
    });

    return { success: true, response: response.data };
  } catch (error) {
    logger.error(`Error updating call in Google Sheets: ${error.message}`, {
      callId: callData.call_id,
      error
    });

    // Check if error is related to rate limiting
    if (error.code === 429 || (error.response && error.response.status === 429)) {
      logger.warn('Rate limit error when updating call, will retry later', {
        callId: callData.call_id
      });

      // Queue for retry
      queueForRetry({
        type: 'updateCall',
        data: callData,
        retryCount: 0
      });

      return { success: false, retrying: true, error: error.message };
    }

    return { success: false, error: error.message };
  }
}

/**
 * Poll for updates to calls and log them to Google Sheets
 * @param {number} maxCalls Maximum number of calls to process
 * @returns {Promise<Object>} Result of the polling operation
 */
async function pollCallUpdates(maxCalls = 25) {
  try {
    // Log the rate limiter status before polling
    const tokensBefore = await googleSheetsRateLimiter.getAvailableTokens();
    logger.info(`Starting poll for call updates (${tokensBefore} tokens available)`);

    // If we have retry operations in the queue, process those first
    if (retryQueue.length > 0) {
      await processRetryQueue();
    }

    // If tokens are low, wait for more before continuing
    const tokensAfterRetry = await googleSheetsRateLimiter.getAvailableTokens();
    if (tokensAfterRetry < 5) {
      logger.warn(`Low tokens available (${tokensAfterRetry}), waiting for refill`);
      // Wait for token refill (up to 10 seconds)
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    // Fetch calls that need updates (in_progress or completed but without transcript/recording)
    const { data: calls, error } = await supabase
      .from('calls')
      .select('*')
      .or('status.eq.in_progress,and(status.eq.completed,transcript.is.null)')
      .order('updated_at', { ascending: false })
      .limit(maxCalls);

    if (error) {
      logger.error(`Error fetching calls for update: ${error.message}`, { error });
      return { success: false, error: error.message };
    }

    if (!calls || calls.length === 0) {
      logger.info('No calls found needing updates');
      return { success: true, updatedCount: 0 };
    }

    logger.info(`Found ${calls.length} calls to update`);

    // Process calls in batches to avoid rate limiting
    const batchSize = 5;
    const batches = [];

    // Split calls into batches
    for (let i = 0; i < calls.length; i += batchSize) {
      batches.push(calls.slice(i, i + batchSize));
    }

    let updatedCount = 0;

    // Process each batch
    for (const batch of batches) {
      // Process batch in parallel
      const results = await Promise.all(batch.map(async (call) => {
        try {
          // For in_progress calls, check status with Bland.AI
          if (call.status === 'in_progress') {
            const blandCall = await fetchBlandAICallDetails(call.call_id);
            
            if (blandCall && blandCall.status === 'success' && blandCall.call) {
              // Update local database with latest status
              await updateCallInDatabase(call.id, blandCall.call);
              
              // Update Google Sheets
              await updateCallInGoogleSheets({
                call_id: call.call_id,
                status: blandCall.call.status,
                duration: blandCall.call.call_length_seconds,
                transcript: blandCall.call.transcript,
                recording_url: blandCall.call.recording_url,
                cost: blandCall.call.cost
              }, true); // Mark as batchable
              
              return { success: true, updated: true };
            }
          } 
          // For completed calls without transcript/recording, fetch details
          else if (call.status === 'completed' && (!call.transcript || !call.recording_url)) {
            const blandCall = await fetchBlandAICallDetails(call.call_id);
            
            if (blandCall && blandCall.status === 'success' && blandCall.call) {
              // Update local database with transcript/recording
              await updateCallInDatabase(call.id, blandCall.call);
              
              // Update Google Sheets
              await updateCallInGoogleSheets({
                call_id: call.call_id,
                transcript: blandCall.call.transcript,
                recording_url: blandCall.call.recording_url
              }, true); // Mark as batchable
              
              return { success: true, updated: true };
            }
          }
          
          return { success: true, updated: false };
        } catch (error) {
          logger.error(`Error updating call ${call.call_id}: ${error.message}`, {
            callId: call.call_id,
            error
          });
          return { success: false, error: error.message };
        }
      }));
      
      // Count successful updates
      updatedCount += results.filter(r => r.success && r.updated).length;
      
      // Wait a bit between batches to avoid rate limiting
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Flush any pending batches
    await flushAllBatches();

    // Log the rate limiter status after polling
    const tokensAfter = await googleSheetsRateLimiter.getAvailableTokens();
    logger.info(`Completed poll for call updates (${tokensAfter} tokens available)`, {
      updatedCount
    });

    return { success: true, updatedCount };
  } catch (error) {
    logger.error(`Error in pollCallUpdates: ${error.message}`, { error });
    return { success: false, error: error.message };
  }
}

/**
 * Queue an operation for retry
 * @param {Object} operation Operation to retry
 */
function queueForRetry(operation) {
  retryQueue.push(operation);
  logger.debug(`Added operation to retry queue (new size: ${retryQueue.length})`, {
    operationType: operation.type,
    callId: operation.data?.call_id
  });
  
  // Start processing the queue if not already processing
  if (!isProcessingRetryQueue) {
    processRetryQueue();
  }
}

/**
 * Process the retry queue
 * @returns {Promise<void>}
 */
async function processRetryQueue() {
  // If already processing or queue is empty, return
  if (isProcessingRetryQueue || retryQueue.length === 0) {
    return;
  }
  
  isProcessingRetryQueue = true;
  logger.info(`Processing retry queue (size: ${retryQueue.length})`);
  
  try {
    // Check available tokens
    const availableTokens = await googleSheetsRateLimiter.getAvailableTokens();
    
    // If tokens are low, wait and try again later
    if (availableTokens < 2) {
      logger.warn(`Not enough tokens to process retry queue (${availableTokens} available)`, {
        queueSize: retryQueue.length
      });
      
      // Wait for token refill (5-15 seconds based on queue size)
      const waitTime = Math.min(5000 + (retryQueue.length * 500), 15000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      isProcessingRetryQueue = false;
      return;
    }
    
    // Process a batch of operations
    const batch = retryQueue.splice(0, Math.min(RETRY_BATCH_SIZE, retryQueue.length));
    
    logger.info(`Processing ${batch.length} retry operations (${retryQueue.length} remaining)`);
    
    // Execute retries
    for (const operation of batch) {
      try {
        // Increment retry count
        operation.retryCount += 1;
        
        // Check if max retries reached
        if (operation.retryCount > MAX_RETRY_COUNT) {
          logger.warn(`Max retries reached for operation`, {
            operationType: operation.type,
            callId: operation.data?.call_id,
            retryCount: operation.retryCount
          });
          continue;
        }
        
        // Execute based on operation type
        if (operation.type === 'logCall') {
          await logCallToGoogleSheets(operation.data, false);
        } else if (operation.type === 'updateCall') {
          await updateCallInGoogleSheets(operation.data, false);
        }
        
        // Wait between operations
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error(`Error executing retry operation: ${error.message}`, {
          operationType: operation.type,
          callId: operation.data?.call_id,
          error
        });
        
        // Re-queue if still within retry limit
        if (operation.retryCount <= MAX_RETRY_COUNT) {
          retryQueue.push(operation);
        }
      }
    }
    
    // If more operations in queue, continue processing
    if (retryQueue.length > 0) {
      setImmediate(processRetryQueue);
    } else {
      logger.info('Retry queue processing completed');
    }
  } catch (error) {
    logger.error(`Error processing retry queue: ${error.message}`, { error });
  } finally {
    isProcessingRetryQueue = false;
  }
}

// Helper function to fetch call details from Bland.AI
async function fetchBlandAICallDetails(callId) {
  try {
    const response = await axios.get(
      `https://api.bland.ai/v1/calls/${callId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.BLAND_ENTERPRISE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    logger.error(`Error fetching call details from Bland.AI: ${error.message}`, {
      callId,
      error
    });
    throw error;
  }
}

// Helper function to update call in database
async function updateCallInDatabase(id, blandCall) {
  try {
    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    if (blandCall.status) {
      updateData.status = blandCall.status;
    }
    
    if (blandCall.call_length_seconds) {
      updateData.duration = blandCall.call_length_seconds;
    }
    
    if (blandCall.transcript) {
      updateData.transcript = blandCall.transcript;
    }
    
    if (blandCall.recording_url) {
      updateData.recording_url = blandCall.recording_url;
    }
    
    if (blandCall.cost) {
      updateData.cost = blandCall.cost;
    }
    
    const { error } = await supabase
      .from('calls')
      .update(updateData)
      .eq('id', id);
      
    if (error) {
      logger.error(`Error updating call in database: ${error.message}`, {
        id,
        error
      });
      throw error;
    }
    
    return true;
  } catch (error) {
    logger.error(`Error in updateCallInDatabase: ${error.message}`, {
      id,
      error
    });
    throw error;
  }
}

module.exports = {
  logCallToGoogleSheets,
  updateCallInGoogleSheets,
  pollCallUpdates
}; 