/**
 * Rate Limiter for API Calls
 * 
 * This module provides rate limiting functionality using the token bucket algorithm.
 */

const { logger } = require('./logger');

/**
 * Token Bucket Rate Limiter
 * 
 * Implements the token bucket algorithm for rate limiting.
 * Each bucket has a maximum capacity and refills at a constant rate.
 * API calls consume tokens from the bucket, and are rejected if the bucket is empty.
 */
class TokenBucketRateLimiter {
  /**
   * Create a new rate limiter
   * @param {string} name Name of this rate limiter for logging
   * @param {number} tokensPerSecond Rate at which tokens refill (tokens per second)
   * @param {number} bucketCapacity Maximum number of tokens the bucket can hold
   * @param {boolean} [waitIfExceeded=false] Whether to wait for tokens if exceeded (vs. rejecting immediately)
   * @param {number} [maxWaitMs=0] Maximum time to wait for tokens in milliseconds (0 = no limit)
   */
  constructor(name, tokensPerSecond, bucketCapacity, waitIfExceeded = false, maxWaitMs = 0) {
    this.name = name;
    this.tokensPerSecond = tokensPerSecond;
    this.bucketCapacity = bucketCapacity;
    this.waitIfExceeded = waitIfExceeded;
    this.maxWaitMs = maxWaitMs;
    
    // Initialize bucket with full capacity
    this.availableTokens = bucketCapacity;
    this.lastRefillTimestamp = Date.now();
    
    // Stats for monitoring
    this.requestsTotal = 0;
    this.requestsLimited = 0;
    this.requestsDelayed = 0;
    
    logger.info(`Rate limiter initialized: ${name}`, {
      tokensPerSecond,
      bucketCapacity,
      waitIfExceeded,
      maxWaitMs
    });
  }
  
  /**
   * Refill tokens based on elapsed time
   * @private
   */
  _refillTokens() {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillTimestamp;
    
    if (elapsedMs > 0) {
      // Calculate tokens to add based on elapsed time
      const tokensToAdd = (elapsedMs / 1000) * this.tokensPerSecond;
      
      // Add tokens, but don't exceed capacity
      this.availableTokens = Math.min(this.bucketCapacity, this.availableTokens + tokensToAdd);
      this.lastRefillTimestamp = now;
    }
  }
  
  /**
   * Try to consume tokens from the bucket
   * @param {number} tokens Number of tokens to consume
   * @returns {Promise<boolean>} True if tokens were consumed, false if rate limit exceeded
   */
  async tryConsume(tokens = 1) {
    this.requestsTotal++;
    
    // Refill tokens based on elapsed time
    this._refillTokens();
    
    // Check if there are enough tokens
    if (this.availableTokens >= tokens) {
      // Consume tokens
      this.availableTokens -= tokens;
      return true;
    }
    
    // If we shouldn't wait, reject immediately
    if (!this.waitIfExceeded) {
      this.requestsLimited++;
      logger.warn(`Rate limit exceeded for ${this.name}`, {
        requestedTokens: tokens,
        availableTokens: this.availableTokens,
        bucketCapacity: this.bucketCapacity
      });
      return false;
    }
    
    // Calculate wait time
    const tokensNeeded = tokens - this.availableTokens;
    const waitTimeMs = (tokensNeeded / this.tokensPerSecond) * 1000;
    
    // Check if wait time exceeds maximum
    if (this.maxWaitMs > 0 && waitTimeMs > this.maxWaitMs) {
      this.requestsLimited++;
      logger.warn(`Rate limit exceeded for ${this.name} (wait time too long)`, {
        requestedTokens: tokens,
        availableTokens: this.availableTokens,
        waitTimeMs,
        maxWaitMs: this.maxWaitMs
      });
      return false;
    }
    
    // Wait for tokens to become available
    this.requestsDelayed++;
    logger.info(`Rate limiting request for ${this.name}`, {
      requestedTokens: tokens,
      availableTokens: this.availableTokens,
      waitTimeMs
    });
    
    // Wait for tokens to refill
    await new Promise(resolve => setTimeout(resolve, waitTimeMs));
    
    // Consume tokens (should be available now)
    this._refillTokens();
    this.availableTokens -= tokens;
    
    return true;
  }
  
  /**
   * Wait for tokens to become available, throwing error if rate limit exceeded
   * @param {number} tokens Number of tokens to consume
   * @returns {Promise<void>} Resolves when tokens are consumed, rejects if rate limit exceeded
   */
  async consume(tokens = 1) {
    const success = await this.tryConsume(tokens);
    if (!success) {
      throw new Error(`Rate limit exceeded for ${this.name}`);
    }
  }
  
  /**
   * Get statistics about this rate limiter
   * @returns {Object} Statistics object
   */
  getStats() {
    this._refillTokens(); // Update tokens first
    
    return {
      name: this.name,
      availableTokens: this.availableTokens,
      bucketCapacity: this.bucketCapacity,
      tokensPerSecond: this.tokensPerSecond,
      usagePercent: (1 - (this.availableTokens / this.bucketCapacity)) * 100,
      requestsTotal: this.requestsTotal,
      requestsLimited: this.requestsLimited,
      requestsDelayed: this.requestsDelayed,
      limitRate: this.requestsTotal > 0 
        ? (this.requestsLimited / this.requestsTotal) * 100 
        : 0,
      delayRate: this.requestsTotal > 0 
        ? (this.requestsDelayed / this.requestsTotal) * 100 
        : 0
    };
  }
  
  /**
   * Reset statistics
   */
  resetStats() {
    this.requestsTotal = 0;
    this.requestsLimited = 0;
    this.requestsDelayed = 0;
  }
}

// Create Google Sheets API rate limiter
// 300 requests per minute = 5 requests per second
const googleSheetsRateLimiter = new TokenBucketRateLimiter(
  'googleSheets',
  5, // tokens per second
  50, // bucket capacity
  true, // wait if exceeded
  10000 // max wait 10 seconds
);

// Export rate limiters
module.exports = {
  TokenBucketRateLimiter,
  googleSheetsRateLimiter
}; 