/**
 * Google Sheets Batch Operations
 * 
 * This module implements batch operations for Google Sheets to optimize API usage,
 * reduce rate limit issues, and improve performance.
 */

const { logger } = require('./logger');
const { sheets } = require('../config/google');
const { googleSheetsRateLimiter } = require('./rate-limiter');
const { redisClient } = require('../config/redis');

// Constants for batch operations
const BATCH_SIZE = 20; // Maximum batch size for updates
const BATCH_TIMEOUT_MS = 10000; // Maximum time to wait before flushing a batch (10 seconds)
const BATCH_KEY_PREFIX = 'google_sheets_batch:';

// In-memory batch storage (fallback if Redis is not available)
const memoryBatches = {
  // sheetId: { 
  //   operations: [], 
  //   timer: null, 
  //   lastUpdate: timestamp 
  // }
};

/**
 * Get the Redis key for a sheet batch
 * @param {string} sheetId The Google Sheet ID
 * @returns {string} The Redis key
 */
function getBatchKey(sheetId) {
  return `${BATCH_KEY_PREFIX}${sheetId}`;
}

/**
 * Add an operation to the batch
 * @param {string} sheetId The Google Sheet ID
 * @param {string} operation The operation type ('append' or 'update')
 * @param {Object} data The operation data
 * @returns {Promise<boolean>} True if added to batch, false if executed immediately
 */
async function addToBatch(sheetId, operation, data) {
  // Check if rate limiter has enough tokens for individual operation
  // If we have plenty of tokens, execute immediately for responsiveness
  const availableTokens = await googleSheetsRateLimiter.getAvailableTokens();
  
  // If we have more than 5 tokens available and it's not a mass update, process immediately
  if (availableTokens > 5 && !data.isBatchable) {
    logger.debug(`Executing Google Sheets operation immediately (tokens: ${availableTokens})`, {
      sheetId,
      operation
    });
    return false; // Not added to batch
  }
  
  // Try to use Redis for batch storage if available
  if (redisClient.isReady) {
    try {
      const batchKey = getBatchKey(sheetId);
      const batchData = await redisClient.get(batchKey);
      
      let batch = batchData ? JSON.parse(batchData) : { operations: [], lastUpdate: Date.now() };
      
      // Add operation to batch
      batch.operations.push({
        operation,
        data,
        timestamp: Date.now()
      });
      
      // Update last update time
      batch.lastUpdate = Date.now();
      
      // Store batch in Redis with a TTL
      await redisClient.set(batchKey, JSON.stringify(batch), { EX: 60 }); // 1 minute TTL
      
      logger.debug(`Added Google Sheets operation to Redis batch (size: ${batch.operations.length})`, {
        sheetId,
        operation,
        batchSize: batch.operations.length
      });
      
      // If batch size threshold reached, flush the batch
      if (batch.operations.length >= BATCH_SIZE) {
        processBatch(sheetId);
      } else {
        // Set a timeout to flush the batch if it's the first operation
        if (batch.operations.length === 1) {
          setTimeout(() => checkAndProcessBatch(sheetId), BATCH_TIMEOUT_MS);
        }
      }
      
      return true;
    } catch (error) {
      logger.error(`Error adding to Redis batch: ${error.message}`, {
        sheetId,
        operation,
        error
      });
      // Fall back to in-memory batching
    }
  }
  
  // In-memory batching (fallback)
  if (!memoryBatches[sheetId]) {
    memoryBatches[sheetId] = {
      operations: [],
      timer: null,
      lastUpdate: Date.now()
    };
  }
  
  const batch = memoryBatches[sheetId];
  
  // Add operation to batch
  batch.operations.push({
    operation,
    data,
    timestamp: Date.now()
  });
  
  // Update last update time
  batch.lastUpdate = Date.now();
  
  logger.debug(`Added Google Sheets operation to memory batch (size: ${batch.operations.length})`, {
    sheetId,
    operation,
    batchSize: batch.operations.length
  });
  
  // If batch size threshold reached, flush the batch
  if (batch.operations.length >= BATCH_SIZE) {
    clearTimeout(batch.timer);
    processBatchFromMemory(sheetId);
  } else if (batch.operations.length === 1) {
    // Set a timeout to flush the batch if it's the first operation
    batch.timer = setTimeout(() => processBatchFromMemory(sheetId), BATCH_TIMEOUT_MS);
  }
  
  return true;
}

/**
 * Check if a batch needs processing and process it if needed
 * @param {string} sheetId The Google Sheet ID
 * @returns {Promise<void>}
 */
async function checkAndProcessBatch(sheetId) {
  if (redisClient.isReady) {
    try {
      const batchKey = getBatchKey(sheetId);
      const batchData = await redisClient.get(batchKey);
      
      if (batchData) {
        const batch = JSON.parse(batchData);
        
        // Process if batch is not empty and timeout has elapsed
        if (batch.operations && batch.operations.length > 0 && 
            (Date.now() - batch.lastUpdate >= BATCH_TIMEOUT_MS)) {
          await processBatch(sheetId);
        }
      }
    } catch (error) {
      logger.error(`Error checking batch: ${error.message}`, {
        sheetId,
        error
      });
    }
  } else if (memoryBatches[sheetId]) {
    // In-memory fallback
    const batch = memoryBatches[sheetId];
    
    // Process if batch is not empty and timeout has elapsed
    if (batch.operations.length > 0 && 
        (Date.now() - batch.lastUpdate >= BATCH_TIMEOUT_MS)) {
      await processBatchFromMemory(sheetId);
    }
  }
}

/**
 * Process a batch from Redis
 * @param {string} sheetId The Google Sheet ID
 * @returns {Promise<void>}
 */
async function processBatch(sheetId) {
  if (!redisClient.isReady) {
    return processBatchFromMemory(sheetId);
  }
  
  try {
    const batchKey = getBatchKey(sheetId);
    const batchData = await redisClient.get(batchKey);
    
    if (!batchData) {
      logger.debug(`No batch found for sheet ${sheetId}`, { sheetId });
      return;
    }
    
    const batch = JSON.parse(batchData);
    
    if (!batch.operations || batch.operations.length === 0) {
      logger.debug(`Empty batch for sheet ${sheetId}`, { sheetId });
      return;
    }
    
    logger.info(`Processing Google Sheets batch for ${sheetId} (size: ${batch.operations.length})`, {
      sheetId,
      batchSize: batch.operations.length
    });
    
    // Sort operations by type and timestamp
    const sortedOperations = [...batch.operations].sort((a, b) => {
      // Sort by operation type (updates first, then appends)
      if (a.operation !== b.operation) {
        return a.operation === 'update' ? -1 : 1;
      }
      // Then sort by timestamp (oldest first)
      return a.timestamp - b.timestamp;
    });
    
    // Wait for rate limiter tokens
    await googleSheetsRateLimiter.acquireTokens(2); // 2 tokens for a batch operation
    
    // Execute batch operations by type
    const updateOperations = sortedOperations.filter(op => op.operation === 'update');
    const appendOperations = sortedOperations.filter(op => op.operation === 'append');
    
    // Process updates
    if (updateOperations.length > 0) {
      try {
        await processBatchUpdates(sheetId, updateOperations);
      } catch (error) {
        logger.error(`Error processing batch updates: ${error.message}`, {
          sheetId,
          error,
          operationCount: updateOperations.length
        });
      }
    }
    
    // Process appends
    if (appendOperations.length > 0) {
      try {
        await processBatchAppends(sheetId, appendOperations);
      } catch (error) {
        logger.error(`Error processing batch appends: ${error.message}`, {
          sheetId,
          error,
          operationCount: appendOperations.length
        });
      }
    }
    
    // Clear the batch
    await redisClient.del(batchKey);
    
    logger.info(`Successfully processed Google Sheets batch for ${sheetId}`, {
      sheetId,
      operationCount: batch.operations.length
    });
  } catch (error) {
    logger.error(`Error processing batch from Redis: ${error.message}`, {
      sheetId,
      error
    });
  }
}

/**
 * Process a batch from memory
 * @param {string} sheetId The Google Sheet ID
 * @returns {Promise<void>}
 */
async function processBatchFromMemory(sheetId) {
  const batch = memoryBatches[sheetId];
  
  if (!batch || batch.operations.length === 0) {
    logger.debug(`No memory batch found for sheet ${sheetId}`, { sheetId });
    return;
  }
  
  logger.info(`Processing Google Sheets memory batch for ${sheetId} (size: ${batch.operations.length})`, {
    sheetId,
    batchSize: batch.operations.length
  });
  
  // Clear any pending timeout
  if (batch.timer) {
    clearTimeout(batch.timer);
    batch.timer = null;
  }
  
  // Sort operations by type and timestamp
  const sortedOperations = [...batch.operations].sort((a, b) => {
    // Sort by operation type (updates first, then appends)
    if (a.operation !== b.operation) {
      return a.operation === 'update' ? -1 : 1;
    }
    // Then sort by timestamp (oldest first)
    return a.timestamp - b.timestamp;
  });
  
  // Wait for rate limiter tokens
  await googleSheetsRateLimiter.acquireTokens(2); // 2 tokens for a batch operation
  
  // Execute batch operations by type
  const updateOperations = sortedOperations.filter(op => op.operation === 'update');
  const appendOperations = sortedOperations.filter(op => op.operation === 'append');
  
  // Process updates
  if (updateOperations.length > 0) {
    try {
      await processBatchUpdates(sheetId, updateOperations);
    } catch (error) {
      logger.error(`Error processing memory batch updates: ${error.message}`, {
        sheetId,
        error,
        operationCount: updateOperations.length
      });
    }
  }
  
  // Process appends
  if (appendOperations.length > 0) {
    try {
      await processBatchAppends(sheetId, appendOperations);
    } catch (error) {
      logger.error(`Error processing memory batch appends: ${error.message}`, {
        sheetId,
        error,
        operationCount: appendOperations.length
      });
    }
  }
  
  // Clear the batch
  batch.operations = [];
  batch.lastUpdate = Date.now();
  
  logger.info(`Successfully processed Google Sheets memory batch for ${sheetId}`, {
    sheetId,
    operationCount: sortedOperations.length
  });
}

/**
 * Process batch update operations
 * @param {string} sheetId The Google Sheet ID
 * @param {Array} operations The update operations
 * @returns {Promise<void>}
 */
async function processBatchUpdates(sheetId, operations) {
  if (operations.length === 0) return;
  
  // Group updates by sheet tab/range for efficiency
  const updatesByRange = {};
  
  for (const op of operations) {
    const { data } = op;
    const rangeKey = `${data.tab}!${data.range}`;
    
    if (!updatesByRange[rangeKey]) {
      updatesByRange[rangeKey] = {
        tab: data.tab,
        range: data.range,
        values: []
      };
    }
    
    // For updates we need to keep track of row index
    // and make sure to update the correct cell(s)
    if (data.rowIndex !== undefined) {
      updatesByRange[rangeKey].values[data.rowIndex] = data.values;
    }
  }
  
  // Execute updates by range
  for (const rangeKey in updatesByRange) {
    const update = updatesByRange[rangeKey];
    
    try {
      // Filter out any undefined entries (gaps in the update array)
      const values = Array.isArray(update.values) 
        ? update.values.filter(val => val !== undefined)
        : [];
      
      if (values.length === 0) continue;
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${update.tab}!${update.range}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values }
      });
      
      logger.info(`Batch updated ${values.length} rows in range ${rangeKey}`, {
        sheetId,
        rangeKey,
        rowCount: values.length
      });
    } catch (error) {
      logger.error(`Error updating range ${rangeKey}: ${error.message}`, {
        sheetId,
        rangeKey,
        error
      });
    }
  }
}

/**
 * Process batch append operations
 * @param {string} sheetId The Google Sheet ID
 * @param {Array} operations The append operations
 * @returns {Promise<void>}
 */
async function processBatchAppends(sheetId, operations) {
  if (operations.length === 0) return;
  
  // Group appends by sheet tab for efficiency
  const appendsByTab = {};
  
  for (const op of operations) {
    const { data } = op;
    
    if (!appendsByTab[data.tab]) {
      appendsByTab[data.tab] = {
        tab: data.tab,
        values: []
      };
    }
    
    // For appends we add all rows to be appended
    appendsByTab[data.tab].values.push(...data.values);
  }
  
  // Execute appends by tab
  for (const tab in appendsByTab) {
    const append = appendsByTab[tab];
    
    try {
      const values = Array.isArray(append.values) ? append.values : [];
      
      if (values.length === 0) continue;
      
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${append.tab}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values }
      });
      
      logger.info(`Batch appended ${values.length} rows to tab ${tab}`, {
        sheetId,
        tab,
        rowCount: values.length
      });
    } catch (error) {
      logger.error(`Error appending to tab ${tab}: ${error.message}`, {
        sheetId,
        tab,
        error
      });
    }
  }
}

/**
 * Flush all pending batches immediately
 * @returns {Promise<void>}
 */
async function flushAllBatches() {
  logger.info('Flushing all Google Sheets batches');
  
  // Flush Redis batches
  if (redisClient.isReady) {
    try {
      const keys = await redisClient.keys(`${BATCH_KEY_PREFIX}*`);
      
      for (const key of keys) {
        const sheetId = key.replace(BATCH_KEY_PREFIX, '');
        await processBatch(sheetId);
      }
    } catch (error) {
      logger.error(`Error flushing Redis batches: ${error.message}`, { error });
    }
  }
  
  // Flush memory batches
  const sheetIds = Object.keys(memoryBatches);
  
  for (const sheetId of sheetIds) {
    await processBatchFromMemory(sheetId);
  }
  
  logger.info('All Google Sheets batches flushed');
}

module.exports = {
  addToBatch,
  processBatch,
  flushAllBatches,
  BATCH_SIZE,
  BATCH_TIMEOUT_MS
}; 