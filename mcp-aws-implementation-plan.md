# Bland.AI MCP AWS Implementation Plan

## Overview

This document outlines the step-by-step implementation plan for deploying the Bland.AI MCP (Model Context Protocol) service to AWS. It provides a detailed roadmap for setting up infrastructure, configuring services, and ensuring the application runs reliably in a production environment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Application Configuration](#application-configuration)
4. [Deployment Process](#deployment-process)
5. [Testing and Validation](#testing-and-validation)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)
7. [Rollback Plan](#rollback-plan)
8. [Security Considerations](#security-considerations)
9. [Cost Management](#cost-management)
10. [Future Improvements](#future-improvements)

## Prerequisites

Before starting the implementation, ensure you have:

- [ ] AWS account with appropriate permissions
- [ ] Bland.AI Enterprise API key
- [ ] Supabase project configured with tables for users, credits, and call history
- [ ] Google Sheets API credentials configured
- [ ] Domain name for the service (optional)
- [ ] Local development environment with Node.js, npm, AWS CLI, and Terraform installed
- [ ] Basic understanding of AWS services (EC2, Lambda, CloudFront, S3, CloudWatch)

## Infrastructure Setup

### 1. Prepare Local Environment (Day 1)

- [ ] Clone the repository locally
- [ ] Install required dependencies
- [ ] Run `./infra/scripts/setup.sh` to create necessary deployment directories
- [ ] Copy `.env.deploy.example` to `.env.deploy` and configure with appropriate values

### 2. Set Up AWS Network Resources (Day 1)

- [ ] Create or identify VPC for deployment
- [ ] Configure subnets with appropriate routing
- [ ] Set up Internet Gateway for external access
- [ ] Configure security groups for EC2 instances
- [ ] Create appropriate IAM roles and policies

### 3. Configure S3 for Storage (Day 1-2)

- [ ] Create S3 bucket for static assets and call recordings
- [ ] Configure bucket policy and CORS settings
- [ ] Set up lifecycle policies for cost optimization
- [ ] Enable versioning for critical assets

### 4. Set Up Lambda for Call Updates (Day 2)

- [ ] Run `node infra/scripts/package-lambda.js` to create the Lambda deployment package
- [ ] Deploy Lambda function via Terraform
- [ ] Configure CloudWatch Events to trigger Lambda every 5 minutes
- [ ] Set up CloudWatch Alarms for Lambda errors
- [ ] Configure Dead Letter Queue for failed executions

### 5. Deploy EC2 Application Server (Day 2-3)

- [ ] Run `./infra/scripts/deploy.sh [environment]` to deploy EC2 instance
- [ ] Verify EC2 instance is running with the application installed
- [ ] Configure security groups to allow appropriate traffic
- [ ] Set up auto-recovery for EC2 instance

### 6. Configure CloudFront (Day 3)

- [ ] Create CloudFront distribution pointing to EC2 instance
- [ ] Configure caching behaviors for static and dynamic content
- [ ] Set up HTTPS with appropriate certificates
- [ ] Configure DNS to point to CloudFront distribution

## Application Configuration

### 7. Environment Configuration (Day 3)

- [ ] Set environment variables on EC2 instance
- [ ] Configure application settings for production
- [ ] Set up database connection with proper security
- [ ] Configure Google Sheets rate limiting

### 8. MCP Server Configuration (Day 4)

- [ ] Verify MCP server routes are properly configured
- [ ] Configure authentication middleware
- [ ] Set up tool registrations
- [ ] Configure resource endpoints
- [ ] Implement proper error handling and logging

### 9. Configure Rate Limiting (Day 4)

- [ ] Implement rate limiting for API endpoints
- [ ] Configure Google Sheets rate limiter with token bucket algorithm
- [ ] Implement retry mechanisms for rate-limited operations
- [ ] Configure monitoring for rate limit issues

## Deployment Process

### 10. Initial Deployment (Day 5)

- [ ] Run final checks on infrastructure configuration
- [ ] Deploy application to EC2 instance
- [ ] Verify application is running correctly
- [ ] Run initial tests on API endpoints

### 11. Database Migration (Day 5)

- [ ] Verify Supabase tables are correctly configured
- [ ] Run any necessary database migrations
- [ ] Verify database connections from the application
- [ ] Test database operations

### 12. Production Configuration (Day 5-6)

- [ ] Set up PM2 for process management
- [ ] Configure application for production performance
- [ ] Set up automatic restarts for application processes
- [ ] Configure log rotation

## Testing and Validation

### 13. Functional Testing (Day 6)

- [ ] Test MCP server functionality
- [ ] Verify phone call tool operations
- [ ] Test credit system functionality
- [ ] Verify call history access

### 14. Load Testing (Day 6-7)

- [ ] Conduct load tests on API endpoints
- [ ] Verify rate limiting functionality under load
- [ ] Test Google Sheets logging under load
- [ ] Verify Lambda function behavior under various conditions

### 15. Integration Testing (Day 7)

- [ ] Test integration with Bland.AI API
- [ ] Verify Google Sheets logging and polling
- [ ] Test Supabase integration
- [ ] Validate end-to-end flow for phone calls

## Monitoring and Maintenance

### 16. Set Up Monitoring (Day 7-8)

- [ ] Configure CloudWatch dashboards for key metrics
- [ ] Set up CloudWatch Alarms for critical resources
- [ ] Configure SNS notifications for alarms
- [ ] Set up logging aggregation

### 17. Implement Health Checks (Day 8)

- [ ] Configure health check endpoints
- [ ] Set up CloudWatch Route 53 health checks
- [ ] Configure recovery actions for failed health checks
- [ ] Test failover scenarios

### 18. Backup Configuration (Day 8)

- [ ] Configure regular backups for EC2 instance
- [ ] Set up S3 backup policies
- [ ] Document backup and restore procedures
- [ ] Test restoration process

## Rollback Plan

### 19. Create Rollback Procedure (Day 9)

- [ ] Document step-by-step rollback procedures
- [ ] Create backup snapshots before major changes
- [ ] Configure automated rollback triggers
- [ ] Test rollback procedures

## Security Considerations

### 20. Security Hardening (Day 9-10)

- [ ] Implement AWS WAF for application protection
- [ ] Configure security headers for EC2 instance
- [ ] Review and update IAM permissions
- [ ] Implement IP-based restrictions for sensitive endpoints
- [ ] Configure AWS Shield for DDoS protection (optional)

### 21. Security Testing (Day 10)

- [ ] Conduct security scan of deployed infrastructure
- [ ] Test authentication and authorization mechanisms
- [ ] Verify data encryption in transit and at rest
- [ ] Document security findings and remediation steps

## Cost Management

### 22. Cost Optimization (Day 10-11)

- [ ] Review resource utilization and adjust instance sizes
- [ ] Configure auto-scaling policies based on demand
- [ ] Implement S3 lifecycle policies for cost reduction
- [ ] Set up AWS Cost Explorer and Budgets for monitoring

### 23. Performance Optimization (Day 11)

- [ ] Review and optimize Lambda function performance
- [ ] Configure CloudFront caching for performance
- [ ] Optimize database queries
- [ ] Implement front-end performance optimizations

## Future Improvements

### 24. Continuous Integration/Deployment (Post-Implementation)

- [ ] Set up CI/CD pipeline for automated deployments
- [ ] Configure automated testing in the pipeline
- [ ] Implement blue-green deployment strategy
- [ ] Set up deployment notifications

### 25. Service Scaling (Post-Implementation)

- [ ] Implement auto-scaling for EC2 instances
- [ ] Configure load balancing for high availability
- [ ] Implement database scaling strategy
- [ ] Document scaling procedures

## Timeline Summary

| Phase | Days | Key Activities |
|-------|------|---------------|
| Infrastructure Setup | 1-3 | AWS network resources, S3, Lambda, EC2, CloudFront |
| Application Configuration | 3-4 | Environment variables, MCP server, rate limiting |
| Deployment Process | 5-6 | Initial deployment, database migration, production configuration |
| Testing and Validation | 6-7 | Functional testing, load testing, integration testing |
| Monitoring and Maintenance | 7-8 | CloudWatch, health checks, backup configuration |
| Rollback Plan | 9 | Rollback procedures and testing |
| Security Considerations | 9-10 | Security hardening and testing |
| Cost Management | 10-11 | Resource optimization, cost monitoring |
| Future Improvements | Post | CI/CD, service scaling |

## Success Criteria

- [ ] MCP server is deployed and accessible via HTTPS
- [ ] Phone call tool functions correctly through the MCP interface
- [ ] Google Sheets logging operates within rate limits
- [ ] Lambda function reliably polls for call updates
- [ ] Monitoring is in place with appropriate alerting
- [ ] Backup and recovery procedures are documented and tested
- [ ] Security controls are implemented and verified
- [ ] Cost optimization measures are in place

## Appendices

### Appendix A: Resource Specifications

| Resource | Specification | Estimated Cost (Monthly) |
|----------|--------------|--------------------------|
| EC2 Instance | t3.small | $15-30 |
| Lambda Function | 256MB, 300s timeout | $2-5 |
| S3 Storage | 10GB | $0.20-0.30 |
| CloudFront | 50GB transfer | $5-10 |
| CloudWatch | Logs + Alarms | $5-10 |
| Total | | $27-55 |

### Appendix B: Rate Limiting Considerations

- Google Sheets API: 5 requests per second (token bucket capacity: 50)
- Bland.AI API: Follow Enterprise tier limits
- MCP API endpoints: 100 requests per minute per IP

### Appendix C: References

- [AWS Best Practices](https://aws.amazon.com/architecture/best-practices/)
- [Terraform Documentation](https://www.terraform.io/docs)
- [MCP Specification](https://github.com/Model-Interoperability/mcp/blob/main/MCP_API_SPECS.md)
- [Node.js Performance Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html) 