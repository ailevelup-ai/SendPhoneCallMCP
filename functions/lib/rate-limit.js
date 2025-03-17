const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS || 900000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = process.env.RATE_LIMIT_MAX_REQUESTS || 100;

const TABLE_NAME = process.env.RATE_LIMIT_TABLE || `${process.env.SERVICE_NAME}-${process.env.STAGE}-rate-limits`;

/**
 * Check if user has exceeded rate limit
 * @param {string} userId - User ID to check
 * @returns {Promise<Object>} - Rate limit check result
 */
async function getRateLimit(userId) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  try {
    // Query recent requests
    const result = await dynamodb.query({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'id = :userId AND #ts >= :start',
      ExpressionAttributeNames: {
        '#ts': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':start': windowStart
      }
    }).promise();

    const requestCount = result.Items.length;

    return {
      allowed: requestCount < RATE_LIMIT_MAX_REQUESTS,
      current: requestCount,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - requestCount),
      resetTime: windowStart + RATE_LIMIT_WINDOW_MS
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // Default to allowing the request if there's an error
    return {
      allowed: true,
      current: 0,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining: RATE_LIMIT_MAX_REQUESTS,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    };
  }
}

/**
 * Update rate limit counter for user
 * @param {string} userId - User ID to update
 * @returns {Promise<void>}
 */
async function updateRateLimit(userId) {
  const now = Date.now();
  const ttl = Math.floor((now + RATE_LIMIT_WINDOW_MS) / 1000); // TTL in seconds

  try {
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: {
        id: userId,
        timestamp: now,
        ttl
      }
    }).promise();
  } catch (error) {
    console.error('Error updating rate limit:', error);
    // Continue execution even if rate limit update fails
  }
}

module.exports = {
  getRateLimit,
  updateRateLimit
}; 