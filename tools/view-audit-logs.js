#!/usr/bin/env node
/**
 * Audit Log Viewer
 * 
 * A simple utility to view and search audit logs from DynamoDB
 * Usage: node tools/view-audit-logs.js [options]
 * 
 * Options:
 *   --env [environment]     Environment to view logs for (default: dev)
 *   --level [level]         Filter by log level (INFO, WARNING, ERROR, SECURITY)
 *   --event [eventType]     Filter by event type (API_CALL, PHONE_CALL, etc.)
 *   --action [action]       Filter by action
 *   --user [userId]         Filter by user ID
 *   --resource [resourceId] Filter by resource ID
 *   --days [number]         Number of days to look back (default: 1)
 *   --limit [number]        Maximum number of logs to return (default: 50)
 */

const AWS = require('aws-sdk');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { Command } = require('commander');

// Set up command line options
const program = new Command();
program
  .option('--env <environment>', 'Environment to view logs for', 'dev')
  .option('--level <level>', 'Filter by log level (INFO, WARNING, ERROR, SECURITY)')
  .option('--event <eventType>', 'Filter by event type (API_CALL, PHONE_CALL, etc.)')
  .option('--action <action>', 'Filter by action')
  .option('--user <userId>', 'Filter by user ID')
  .option('--resource <resourceId>', 'Filter by resource ID')
  .option('--days <number>', 'Number of days to look back', '1')
  .option('--limit <number>', 'Maximum number of logs to return', '50')
  .parse(process.argv);

const options = program.opts();

// Load environment variables
const envFile = `.env.${options.env}`;
if (fs.existsSync(envFile)) {
  console.log(`Loading environment from ${envFile}`);
  dotenv.config({ path: envFile });
} else {
  console.log(`Using default .env file`);
  dotenv.config();
}

// Set up AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Service name and table name
const SERVICE_NAME = 'ailevelup-phone-call-mcp';
const AUDIT_TABLE_NAME = `${SERVICE_NAME}-${options.env}-audit-logs`;

// Calculate timestamp for filtering by date
const daysAgo = parseInt(options.days, 10);
const startDate = new Date();
startDate.setDate(startDate.getDate() - daysAgo);
const startTimestamp = startDate.toISOString();

// Function to query the audit logs
async function queryAuditLogs() {
  console.log(`Querying audit logs from ${AUDIT_TABLE_NAME} for the last ${daysAgo} day(s)`);
  
  // Use global secondary index for time-based queries
  const params = {
    TableName: AUDIT_TABLE_NAME,
    IndexName: 'timestamp-index',
    KeyConditionExpression: 'timestamp >= :startTime',
    ExpressionAttributeValues: {
      ':startTime': startTimestamp
    },
    Limit: parseInt(options.limit, 10),
    ScanIndexForward: false // Sort in descending order (newest first)
  };
  
  // Add filter expressions based on command line options
  let filterExpressions = [];
  const expressionAttrNames = {};
  
  if (options.level) {
    filterExpressions.push('#level = :level');
    expressionAttrNames['#level'] = 'level';
    params.ExpressionAttributeValues[':level'] = options.level.toUpperCase();
  }
  
  if (options.event) {
    filterExpressions.push('#eventType = :eventType');
    expressionAttrNames['#eventType'] = 'eventType';
    params.ExpressionAttributeValues[':eventType'] = options.event.toUpperCase();
  }
  
  if (options.action) {
    filterExpressions.push('contains(action, :action)');
    params.ExpressionAttributeValues[':action'] = options.action;
  }
  
  if (options.user) {
    filterExpressions.push('userId = :userId');
    params.ExpressionAttributeValues[':userId'] = options.user;
  }
  
  if (options.resource) {
    filterExpressions.push('resourceId = :resourceId');
    params.ExpressionAttributeValues[':resourceId'] = options.resource;
  }
  
  // Add filter expression if there are any filters
  if (filterExpressions.length > 0) {
    params.FilterExpression = filterExpressions.join(' AND ');
    params.ExpressionAttributeNames = expressionAttrNames;
  }
  
  try {
    const result = await dynamoDB.query(params).promise();
    
    if (result.Items.length === 0) {
      console.log('No audit logs found matching the criteria.');
      return;
    }
    
    console.log(`Found ${result.Items.length} audit logs:`);
    console.log('------------------------------------------------------');
    
    // Format and display each log item
    result.Items.forEach((item, index) => {
      const metadata = item.metadata ? JSON.parse(item.metadata) : {};
      
      console.log(`[${index + 1}] ${item.timestamp} - ${item.level} - ${item.eventType}`);
      console.log(`Action: ${item.action}`);
      if (item.userId) console.log(`User: ${item.userId}`);
      if (item.resourceId) console.log(`Resource: ${item.resourceId}`);
      if (item.ip) console.log(`IP: ${item.ip}`);
      
      // Show metadata in a more readable format
      if (Object.keys(metadata).length > 0) {
        console.log('Metadata:');
        Object.keys(metadata).forEach(key => {
          const value = metadata[key];
          if (typeof value === 'object') {
            console.log(`  ${key}: ${JSON.stringify(value)}`);
          } else {
            console.log(`  ${key}: ${value}`);
          }
        });
      }
      
      console.log('------------------------------------------------------');
    });
    
    console.log(`Showing ${result.Items.length} of ${result.Count} audit logs matching filter criteria`);
    if (result.LastEvaluatedKey) {
      console.log('More logs are available. Refine your search or increase the limit.');
    }
  } catch (error) {
    console.error('Error querying audit logs:', error);
    
    if (error.code === 'ResourceNotFoundException') {
      console.log(`Audit logs table "${AUDIT_TABLE_NAME}" does not exist.`);
      console.log(`Make sure you've set up audit logging for the ${options.env} environment.`);
    }
  }
}

// Run the query
queryAuditLogs(); 