/**
 * Redis Client Configuration
 * 
 * Configures and exports a Redis client for caching and rate limiting.
 */

const { createClient } = require('redis');
const { logger } = require('../utils/logger');

// Initialize Redis client with connection options
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 5000, // 5 seconds
    reconnectStrategy: (retries) => {
      // Exponential backoff with a max delay of 10 seconds
      const delay = Math.min(Math.pow(2, retries) * 1000, 10000);
      logger.info(`Redis reconnect attempt ${retries} in ${delay}ms`);
      return delay;
    }
  }
});

// Redis client event handlers
redisClient.on('connect', () => {
  logger.info('Redis client connecting');
});

redisClient.on('ready', () => {
  logger.info('Redis client connected and ready');
});

redisClient.on('error', (err) => {
  logger.error(`Redis client error: ${err.message}`, { error: err });
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis client reconnecting');
});

redisClient.on('end', () => {
  logger.info('Redis client connection closed');
});

/**
 * Initialize the Redis client connection
 * @returns {Promise<void>}
 */
async function initRedisClient() {
  try {
    // Don't attempt to connect if we're in test mode
    if (process.env.NODE_ENV === 'test') {
      logger.info('Skipping Redis connection in test mode');
      return;
    }
    
    // Connect the client
    await redisClient.connect();
    logger.info('Redis client initialized');
  } catch (error) {
    logger.error(`Failed to initialize Redis client: ${error.message}`, {
      error,
      stack: error.stack
    });
    
    // Set the client to offline mode but allow the app to continue
    logger.warn('Redis features will be disabled');
  }
}

/**
 * Cleanly shut down the Redis client
 * @returns {Promise<void>}
 */
async function shutdownRedisClient() {
  if (redisClient.isReady) {
    logger.info('Shutting down Redis client');
    await redisClient.quit();
    logger.info('Redis client shut down successfully');
  }
}

module.exports = {
  redisClient,
  initRedisClient,
  shutdownRedisClient
}; 