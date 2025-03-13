# Deployment Guide for Bland.AI MCP

This document provides a comprehensive guide to deploying the Bland.AI MCP application to AWS.

## Prerequisites

Before starting the deployment process, ensure you have the following:

1. **AWS Account**: You need an AWS account with appropriate permissions to create the necessary resources.

2. **AWS CLI**: Install and configure the AWS CLI on your local machine.
   ```bash
   # Install AWS CLI
   pip install awscli
   
   # Configure AWS CLI
   aws configure
   ```

3. **Terraform**: Install Terraform on your local machine.
   ```bash
   # For macOS with Homebrew
   brew install terraform
   
   # For Linux (Ubuntu/Debian)
   wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg
   echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
   sudo apt update && sudo apt install terraform
   ```

4. **Node.js and npm**: Install Node.js and npm on your local machine.
   ```bash
   # For macOS with Homebrew
   brew install node
   
   # For Linux (Ubuntu/Debian)
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

5. **Required API Keys and Credentials**:
   - Bland.AI Enterprise API key
   - Supabase URL, service key, and anon key
   - Google Sheets API credentials (client email and private key)
   - JWT secret for authentication

## Deployment Process

### Step 1: Setup Infrastructure Directory

Run the setup script to create the necessary directories and configuration files:

```bash
cd /path/to/SendPhoneCallMCP
./infra/scripts/setup.sh
```

This script will:
- Create required directories
- Add deployment-specific patterns to .gitignore
- Create a .env.deploy.example file
- Set execution permissions for deployment scripts

### Step 2: Configure Deployment Variables

1. Copy the example environment file and edit it with your configuration:
   ```bash
   cp .env.deploy.example .env.deploy
   ```

2. Open `.env.deploy` and fill in all the required values:
   - AWS configuration (region, VPC ID, subnet ID, key pair name)
   - Bland.AI configuration (API key, default phone number, etc.)
   - Supabase configuration (URL, service key, anon key)
   - Google Sheets configuration (document ID, service account credentials)
   - JWT secret
   - Instance configuration (instance type, Lambda memory size, timeout)

3. Source the environment file:
   ```bash
   source .env.deploy
   ```

### Step 3: Deploy the Infrastructure

Run the deployment script with the desired environment parameter (default is "dev"):

```bash
# For development environment
./infra/scripts/deploy.sh dev

# For staging environment
./infra/scripts/deploy.sh staging

# For production environment
./infra/scripts/deploy.sh prod
```

The deployment script will:
1. Check prerequisites
2. Prepare the Lambda function deployment package
3. Initialize Terraform
4. Create the Terraform variables file if it doesn't exist
5. Plan and apply the Terraform configuration
6. Display deployment information

## Infrastructure Components

The deployment includes the following AWS resources:

1. **EC2 Instance**: Hosts the main application server
   - Runs Node.js application with PM2 process manager
   - Serves the React frontend and API endpoints

2. **Lambda Function**: Handles call updates polling
   - Runs on a 5-minute schedule to check for pending calls
   - Single concurrency to prevent overlapping executions
   - Includes DLQ for failed executions

3. **CloudFront Distribution**: CDN for the application
   - Improves performance and global availability
   - Provides HTTPS support

4. **S3 Bucket**: Stores static assets and call recordings

5. **CloudWatch Events**: Schedules the Lambda function execution

6. **CloudWatch Alarms**: Monitors for errors in the Lambda function

7. **SNS Topic**: Sends alerts for infrastructure issues

## Post-Deployment Configuration

After successful deployment, you may need to perform the following steps:

1. **Update DNS**: Point your domain to the CloudFront distribution URL
   ```
   # Example DNS record
   mcp.example.com CNAME d123456abcdef8.cloudfront.net
   ```

2. **Configure HTTPS**: If you're using a custom domain, set up an SSL certificate in AWS Certificate Manager and update the CloudFront distribution

3. **Test the Application**: Verify that the application is running correctly
   ```
   # Test the API endpoint
   curl https://your-app-url.com/api/health
   
   # Access the frontend
   open https://your-app-url.com
   ```

## Troubleshooting

If you encounter issues during deployment, try the following:

1. **Check AWS Credentials**: Ensure your AWS credentials are valid and have the necessary permissions
   ```bash
   aws sts get-caller-identity
   ```

2. **Terraform State**: If Terraform state is corrupted, you may need to clean it
   ```bash
   cd infra/terraform
   rm -rf .terraform
   rm terraform.tfstate terraform.tfstate.backup
   terraform init
   ```

3. **EC2 Connection Issues**: If you can't connect to the EC2 instance, check security groups and key pair
   ```bash
   # Connect to EC2 instance
   ssh -i /path/to/key.pem ec2-user@instance-ip
   
   # Check application logs
   sudo journalctl -u bland-ai-mcp
   pm2 logs
   ```

4. **Lambda Issues**: Check CloudWatch logs for the Lambda function
   ```bash
   aws logs describe-log-groups --log-group-name-prefix /aws/lambda/bland-ai-mcp
   aws logs get-log-events --log-group-name /aws/lambda/bland-ai-mcp-call-updater-dev --log-stream-name latest
   ```

## Maintenance

### Updating the Application

To update the application:

1. Push changes to your GitHub repository
2. SSH into the EC2 instance
   ```bash
   ssh -i /path/to/key.pem ec2-user@instance-ip
   ```
3. Pull the latest changes and restart the application
   ```bash
   cd /home/ec2-user/app
   git pull
   npm install
   npm run build
   pm2 restart all
   ```

### Updating Infrastructure

To update infrastructure configuration:

1. Modify the Terraform files in `infra/terraform/`
2. Run the deployment script again
   ```bash
   ./infra/scripts/deploy.sh [environment]
   ```

### Backups

Important data is stored in:
- Supabase database (automatically backed up)
- Google Sheets (automatically backed up by Google)

Consider implementing additional backup strategies for:
- EC2 instance (AMI snapshots)
- S3 bucket data (cross-region replication)

## Cleanup

To remove all deployed resources when they are no longer needed:

```bash
cd infra/terraform
terraform destroy -var-file=terraform.tfvars
```

**Note**: This will permanently delete all resources created by the Terraform configuration. Make sure to back up any important data before proceeding.

## Security Considerations

- Update the security group to restrict SSH access to trusted IP addresses
- Rotate API keys and JWT secrets regularly
- Enable CloudTrail for auditing
- Consider implementing AWS WAF for additional security

## Cost Optimization

- The default configuration uses t3.small EC2 instances which are cost-effective
- Consider using Reserved Instances for production environments
- Monitor CloudWatch metrics and adjust instance sizes as needed
- Implement auto-scaling for production environments if call volume fluctuates

## Additional Resources

- [AWS Documentation](https://docs.aws.amazon.com/)
- [Terraform Documentation](https://www.terraform.io/docs)
- [Node.js Deployment Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/) 