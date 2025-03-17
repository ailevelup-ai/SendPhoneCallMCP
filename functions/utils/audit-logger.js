/**
 * Audit Logger Module
 * 
 * This module handles audit logging for the API to track usage, 
 * security events, and important operations.
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Initialize AWS services
const cloudWatchLogs = new AWS.CloudWatchLogs();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Environment name from environment variables
const environment = process.env.ENVIRONMENT || 'dev';

// Define log levels
const LOG_LEVELS = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  SECURITY: 'SECURITY'
};

// Define event types
const EVENT_TYPES = {
  API_CALL: 'API_CALL',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  DATA_ACCESS: 'DATA_ACCESS',
  PHONE_CALL: 'PHONE_CALL',
  CONFIGURATION: 'CONFIGURATION',
  BILLING: 'BILLING'
};

// Log group name for CloudWatch Logs
const LOG_GROUP = `/ailevelup-phone-call-mcp/${environment}/audit-logs`;

// DynamoDB table for persistent audit logs
const AUDIT_TABLE = `ailevelup-phone-call-mcp-${environment}-audit-logs`;

// Ensure the log group exists
const ensureLogGroupExists = async () => {
  try {
    await cloudWatchLogs.createLogGroup({
      logGroupName: LOG_GROUP
    }).promise();
    console.log(`Created log group: ${LOG_GROUP}`);
  } catch (error) {
    // Ignore if the log group already exists
    if (error.code !== 'ResourceAlreadyExistsException') {
      console.error('Error creating log group:', error);
    }
  }
};

// Ensure the log stream exists
const ensureLogStreamExists = async (logStreamName) => {
  try {
    await cloudWatchLogs.createLogStream({
      logGroupName: LOG_GROUP,
      logStreamName
    }).promise();
    console.log(`Created log stream: ${logStreamName}`);
  } catch (error) {
    // Ignore if the log stream already exists
    if (error.code !== 'ResourceAlreadyExistsException') {
      console.error('Error creating log stream:', error);
    }
  }
};

// Log to CloudWatch Logs
const logToCloudWatch = async (logEvent) => {
  try {
    // Use the current date as the log stream name (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    const logStreamName = `${today}`;
    
    // Ensure log group and stream exist
    await ensureLogGroupExists();
    await ensureLogStreamExists(logStreamName);
    
    // Put log event
    await cloudWatchLogs.putLogEvents({
      logGroupName: LOG_GROUP,
      logStreamName,
      logEvents: [
        {
          timestamp: new Date().getTime(),
          message: JSON.stringify(logEvent)
        }
      ]
    }).promise();
  } catch (error) {
    console.error('Error logging to CloudWatch:', error);
  }
};

// Log to DynamoDB
const logToDynamoDB = async (logEvent) => {
  try {
    // Check if table exists and create it if needed
    const tableInfo = await dynamoDB.describeTable({
      TableName: AUDIT_TABLE
    }).promise().catch(() => null);
    
    if (!tableInfo) {
      console.log(`Audit table ${AUDIT_TABLE} does not exist. It should be created during deployment.`);
      return;
    }
    
    // Add a timestamp and unique ID to the log event
    const timestamp = new Date().toISOString();
    const item = {
      id: uuidv4(),
      timestamp,
      ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90 days retention
      ...logEvent
    };
    
    // Store the log event in DynamoDB
    await dynamoDB.put({
      TableName: AUDIT_TABLE,
      Item: item
    }).promise();
  } catch (error) {
    console.error('Error logging to DynamoDB:', error);
  }
};

/**
 * Log an audit event
 * 
 * @param {Object} params - Audit log parameters
 * @param {string} params.level - Log level (INFO, WARNING, ERROR, SECURITY)
 * @param {string} params.eventType - Type of event being logged
 * @param {string} params.action - Specific action being performed
 * @param {string} params.resourceId - ID of the resource being accessed/modified
 * @param {string} params.userId - ID of the user performing the action
 * @param {Object} params.metadata - Additional metadata about the event
 * @param {string} params.ip - IP address of the request (if applicable)
 * @param {string} params.userAgent - User agent of the request (if applicable)
 */
const logAuditEvent = async (params) => {
  const { 
    level = LOG_LEVELS.INFO,
    eventType = EVENT_TYPES.API_CALL,
    action,
    resourceId,
    userId,
    metadata = {},
    ip,
    userAgent
  } = params;
  
  // Create the log event object
  const logEvent = {
    level,
    eventType,
    action,
    resourceId,
    userId,
    metadata: JSON.stringify(metadata),
    environment,
    ip,
    userAgent,
    service: 'ailevelup-phone-call-mcp'
  };
  
  // Log to both CloudWatch and DynamoDB
  await Promise.all([
    logToCloudWatch(logEvent),
    logToDynamoDB(logEvent)
  ]);
  
  // Also log to console for local development and debugging
  console.log(`AUDIT [${level}] ${eventType} - ${action}`, logEvent);
};

/**
 * Log an API call event
 */
const logApiCall = async (event, context, userId) => {
  const { 
    path, 
    httpMethod, 
    pathParameters, 
    queryStringParameters, 
    requestContext 
  } = event;
  
  await logAuditEvent({
    level: LOG_LEVELS.INFO,
    eventType: EVENT_TYPES.API_CALL,
    action: `${httpMethod} ${path}`,
    resourceId: pathParameters?.callId,
    userId,
    metadata: {
      pathParameters,
      queryStringParameters,
      lambdaRequestId: context.awsRequestId
    },
    ip: requestContext?.identity?.sourceIp,
    userAgent: requestContext?.identity?.userAgent
  });
};

/**
 * Log a phone call event
 */
const logPhoneCall = async (action, callId, userId, metadata = {}) => {
  await logAuditEvent({
    level: LOG_LEVELS.INFO,
    eventType: EVENT_TYPES.PHONE_CALL,
    action,
    resourceId: callId,
    userId,
    metadata
  });
};

/**
 * Log a security event
 */
const logSecurityEvent = async (action, userId, metadata = {}, ip, userAgent) => {
  await logAuditEvent({
    level: LOG_LEVELS.SECURITY,
    eventType: EVENT_TYPES.SECURITY,
    action,
    userId,
    metadata,
    ip,
    userAgent
  });
};

module.exports = {
  LOG_LEVELS,
  EVENT_TYPES,
  logAuditEvent,
  logApiCall,
  logPhoneCall,
  logSecurityEvent
}; 