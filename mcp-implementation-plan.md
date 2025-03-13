# Model Context Protocol (MCP) Implementation Plan

This document outlines the step-by-step process to convert our Bland.AI phone call service into a Model Context Protocol (MCP) server and migrate it to AWS.

## 1. Project Setup and Environment Preparation

1. Create a new Git branch for MCP implementation
   ```bash
   git checkout -b feature/mcp-server
   ```

2. Install necessary dependencies
   ```bash
   npm install jsonrpc-lite ws uuid jsonschema
   ```

3. Create a dedicated MCP directory structure
   ```
   /mcp
     /tools       # Tool definitions and implementations
     /resources   # Resource definitions and handlers
     /lib         # Utility functions for MCP
     /schema      # JSON schemas for MCP components
     /middleware  # Authentication and validation for MCP
     /routes      # MCP route handlers
   ```

## 2. Core MCP Server Implementation

4. Create a basic MCP server module (`mcp/server.js`)
   - Implement JSON-RPC 2.0 message handling
   - Add capability negotiation
   - Set up HTTP and WebSocket transports
   - Add error handling and logging

5. Implement server initialization and capability advertising
   - Define supported MCP version (2024-11-05)
   - List available tools and resources
   - Implement proper session handling

6. Create MCP route handler in Express
   - Add routes for HTTP transport (`/api/v1/mcp`)
   - Set up WebSocket server (`/mcp`)

7. Implement authentication middleware for MCP endpoints
   - Validate JWT tokens
   - Check user permissions
   - Implement rate limiting specific to MCP

## 3. Tool Implementation

8. Define the tool schemas (`mcp/schema/tools.js`)
   - Create JSON schema for each tool
   - Document parameters, return types, and error codes

9. Implement core phone call tools
   - `makePhoneCall`: Initiate a phone call
   - `getCallDetails`: Get information about a specific call
   - `getCallHistory`: List previous calls with filtering

10. Implement secondary tools
    - `getCallTranscript`: Retrieve transcripts
    - `getCallRecording`: Access call recordings
    - `cancelCall`: Cancel an ongoing call

11. Create tool execution handlers
    - Connect each tool to existing service functions
    - Add proper error handling and validation
    - Implement progress reporting for long-running operations

## 4. Resource Implementation

12. Define resource schemas (`mcp/schema/resources.js`)
    - Create JSON schema for each resource
    - Document properties, relationships, and access patterns

13. Implement call history resources
    - Define call record structure
    - Implement filtering and pagination
    - Add proper access control

14. Implement user and credit resources
    - Expose user profile information
    - Create credit balance and usage resources
    - Ensure proper data security

15. Add resource handlers
    - Connect resources to database queries
    - Implement caching strategy for frequently accessed resources
    - Add validation and transformation logic

## 5. Google Sheets Rate Limiting

16. Implement rate limiting for Google Sheets
    - Create a token bucket implementation for Google Sheets API calls
    - Set up queue for non-urgent write operations
    - Add exponential backoff for retries

17. Implement batch operations
    - Combine multiple single-row operations into batch requests
    - Add prioritization for critical vs. non-critical updates
    - Implement request coalescing for repeated operations

18. Create a monitoring system
    - Track Google Sheets API usage
    - Set up alerts for approaching quota limits
    - Implement fallback mechanisms when limits are reached

19. Add circuit breaker pattern
    - Detect Google Sheets API failures
    - Automatically fail over to local database storage
    - Implement background job for syncing when API becomes available

## 6. Lambda Polling Improvements

20. Update Lambda polling function configuration
    - Set concurrency limit to 1
    - Configure proper timeouts and memory allocation
    - Add dead-letter queue for failed executions

21. Implement checkpoint mechanism
    - Save processing state periodically
    - Resume from last checkpoint if timeout occurs
    - Add proper logging for debugging

22. Create batched processing
    - Process calls in smaller batches to fit time constraints
    - Implement prioritization based on call age and status
    - Add mechanisms to avoid duplicate processing

23. Implement health checks and monitoring
    - Create CloudWatch alarms for Lambda execution
    - Set up notification for failures
    - Add detailed metrics for performance analysis

## 7. Migration to AWS

24. Set up AWS infrastructure using Infrastructure as Code (IaC)
    ```bash
    # Create a new directory for infrastructure code
    mkdir -p infra/terraform
    
    # Initialize Terraform
    cd infra/terraform
    terraform init
    ```

25. Define AWS resources in Terraform
    - EC2 or ECS for application hosting
    - RDS or Aurora for database
    - Lambda for scheduled tasks
    - API Gateway for REST endpoints
    - CloudFront for frontend serving
    - S3 for static assets and recordings

26. Set up CI/CD pipeline
    - Create GitHub Actions workflow
    - Configure deployment stages (dev, staging, production)
    - Add automated testing and quality checks

27. Configure database migration
    - Create migration scripts for Supabase to RDS
    - Set up synchronization period during transition
    - Implement validation checks for data integrity

28. Set up environment configuration
    - Create parameter store entries in AWS Systems Manager
    - Configure environment-specific settings
    - Set up proper secret management

29. Implement logging and monitoring
    - Configure CloudWatch Logs
    - Set up X-Ray for distributed tracing
    - Create custom dashboards for application metrics

## 8. Testing and Validation

30. Create MCP integration tests
    - Test each tool individually
    - Validate resource access patterns
    - Test authentication and authorization

31. Implement load and performance testing
    - Test with simulated load
    - Measure response times under load
    - Identify and fix bottlenecks

32. Perform security testing
    - Conduct vulnerability scanning
    - Test authentication bypass scenarios
    - Validate data protection mechanisms

33. Conduct user acceptance testing
    - Test with real MCP clients
    - Validate real-world scenarios
    - Gather and incorporate feedback

## 9. Documentation

34. Create MCP API documentation
    - Document all available tools
    - Document resource schemas and access patterns
    - Provide examples for common operations

35. Update GitHub repository
    - Add MCP-specific README section
    - Create MCP integration guide
    - Document authentication requirements

36. Create operational documentation
    - Document deployment process
    - Create runbooks for common issues
    - Document monitoring and alerting

37. Implement API documentation endpoint
    - Create self-documenting API
    - Add OpenAPI/Swagger support
    - Implement interactive documentation

## 10. Launch and Post-Launch

38. Perform staged rollout
    - Release to limited users first
    - Monitor for issues
    - Gradually increase availability

39. Implement feedback mechanism
    - Create a process for gathering user feedback
    - Set up communication channels for support
    - Establish a process for feature requests

40. Plan for future enhancements
    - Identify potential improvements
    - Prioritize future work
    - Create a roadmap for ongoing development

## Rate Limiting Considerations

- Google Sheets API has a limit of 300 read/write requests per minute
- Implement a token bucket algorithm with 5 tokens per second (300/60)
- Add request batching to combine operations and reduce API calls
- Implement exponential backoff for retries after rate limit errors
- Consider using local caching to reduce read operations
- Use bulk updates instead of individual cell updates when possible
- Add monitoring to detect approaching limits

## Lambda Polling Considerations

- Set Lambda timeout to maximum (15 minutes) but design for 5-minute completion
- Implement chunking to process data in smaller batches
- Use SQS or Step Functions for handling work that exceeds Lambda timeout
- Set maximum concurrency to 1 to prevent overlapping executions
- Add checkpointing to resume from last successful position
- Implement dead-letter queue for handling failed processing
- Add CloudWatch alarms for timeout and error metrics

## AWS Migration Considerations

- Use separate AWS accounts for development, staging, and production
- Implement proper IAM roles with least privilege principle
- Configure AWS WAF for API protection
- Set up proper network isolation using VPC
- Implement automated backup and restore procedures
- Configure auto-scaling for handling traffic fluctuations
- Implement disaster recovery plan with RTO and RPO targets

This implementation plan provides a structured approach to converting your Bland.AI phone call service into an MCP server while addressing the specific challenges related to rate limiting, Lambda polling, and AWS migration. 