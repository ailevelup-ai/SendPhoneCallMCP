# Monitoring and Audit Logging Guide

This document explains the monitoring and audit logging infrastructure set up for the AilevelUp Phone Call MCP service.

## Overview

Our service implements a comprehensive monitoring and audit logging system that includes:

1. **Performance Monitoring** via CloudWatch dashboards
2. **Cost Monitoring** with budget alerts
3. **Audit Logging** for tracking API usage and important operations
4. **Real-time Dashboards** for system health metrics

## Performance Monitoring

### CloudWatch Dashboards

We've set up CloudWatch dashboards to monitor the performance of our Lambda functions, API Gateway, and DynamoDB tables. 

**Dashboard Path**: `AilevelupPhoneCallMCP-{environment}`

The dashboard includes the following metrics:
- Lambda invocations, errors, and duration
- API Gateway requests, errors, and latency
- DynamoDB consumed capacity

### Deployment

The CloudWatch dashboard is automatically deployed during the deployment process using:

```bash
./deploy-cloudwatch-dashboard.sh <environment> <region>
```

## Cost Monitoring

We've implemented a cost monitoring solution that uses:

1. **AWS Budgets** to set monthly spending limits and receive alerts
2. **Cost Dashboard** to track AWS service usage and estimated charges

### Budget Alerts

The budget is configured to send alerts when spending reaches 80% of the monthly budget. This gives the team time to investigate and take action before exceeding the budget.

### Cost Dashboard

**Dashboard Path**: `AilevelupPhoneCallMCP-{environment}-Cost`

The cost dashboard shows:
- Estimated AWS service charges by service
- Lambda invocations and execution time per day
- API Gateway requests per day
- DynamoDB consumed capacity per day

### Deployment

The cost monitoring infrastructure is deployed using:

```bash
./deploy-cost-monitoring.sh <environment> <region>
```

## Audit Logging

The audit logging system tracks API usage, security events, and important operations. It provides a complete record of activities for troubleshooting and compliance purposes.

### Infrastructure

Audit logs are stored in:
1. **CloudWatch Logs** for real-time analysis and short-term storage
2. **DynamoDB** for persistent storage and querying

**CloudWatch Log Group**: `/ailevelup-phone-call-mcp/{environment}/audit-logs`
**DynamoDB Table**: `ailevelup-phone-call-mcp-{environment}-audit-logs`

### Log Structure

Each audit log entry includes:
- Log level (INFO, WARNING, ERROR, SECURITY)
- Event type (API_CALL, AUTHENTICATION, PHONE_CALL, etc.)
- Action performed
- Resource ID (if applicable)
- User ID (if available)
- Metadata (additional contextual information)
- IP address and user agent (for API calls)
- Timestamp

### Viewing Audit Logs

We've provided a command-line tool to query and view audit logs:

```bash
node tools/view-audit-logs.js --env dev --days 7 --level SECURITY
```

Options:
- `--env`: Environment to view logs for (default: dev)
- `--level`: Filter by log level (INFO, WARNING, ERROR, SECURITY)
- `--event`: Filter by event type (API_CALL, PHONE_CALL, etc.)
- `--action`: Filter by action
- `--user`: Filter by user ID
- `--resource`: Filter by resource ID
- `--days`: Number of days to look back (default: 1)
- `--limit`: Maximum number of logs to return (default: 50)

### Deployment

The audit logging infrastructure is deployed using:

```bash
./setup-audit-logs.sh <environment> <region>
```

## Integration with Lambda Functions

The audit logging system is integrated into the Lambda functions using the `audit-logger.js` utility module. This module provides methods for logging various types of events:

- `logApiCall`: Logs API call events
- `logPhoneCall`: Logs phone call-related events
- `logSecurityEvent`: Logs security events
- `logAuditEvent`: Generic method for logging any audit event

## Maintenance

### Log Retention

- CloudWatch Logs: 90 days retention policy
- DynamoDB Audit Logs: 90 days retention using TTL

### Cost Optimization

To optimize costs related to monitoring and logging:

1. Set appropriate CloudWatch Logs retention periods
2. Use DynamoDB TTL to automatically expire old audit logs
3. Monitor the size and usage of the audit logs table
4. Adjust the frequency of metric collection for non-critical metrics

## Best Practices

1. Use descriptive action names in audit logs for clarity
2. Include relevant context in the metadata field
3. Tag all resources with environment and purpose
4. Review audit logs regularly for security anomalies
5. Set up additional CloudWatch Alarms for critical thresholds 