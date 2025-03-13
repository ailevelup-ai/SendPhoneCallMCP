# Project Dependencies for Bland.AI MCP AWS Deployment

This document outlines the dependencies required for the Bland.AI MCP AWS deployment and provides instructions for managing them.

## Core Dependencies

Make sure your `package.json` includes the following dependencies for deployment:

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "archiver": "^6.0.1",
    "aws-sdk": "^2.1531.0",
    "axios": "^1.6.2",
    "compression": "^1.7.4",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-jwt": "^8.4.1",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "googleapis": "^129.0.0",
    "helmet": "^7.1.0",
    "jsonschema": "^1.4.1",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.0",
    "pm2": "^5.3.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "chai": "^4.3.10",
    "jest": "^29.7.0",
    "mocha": "^10.2.0",
    "nodemon": "^3.0.2",
    "supertest": "^6.3.3"
  }
}
```

## AWS Deployment Dependencies

The following dependencies are specifically important for AWS deployment:

1. **AWS SDK** (`aws-sdk`): Required for interacting with AWS services programmatically.
2. **PM2** (`pm2`): Process manager for running Node.js applications in production.
3. **Winston** (`winston`): Logging library for production-grade logging.
4. **Archiver** (`archiver`): Used for creating zip files for Lambda deployment packages.
5. **Helmet** (`helmet`): Security middleware for Express applications.
6. **Compression** (`compression`): Middleware for response compression in production.

## Installing Dependencies

To install all dependencies for AWS deployment:

```bash
# Install production dependencies
npm install --production

# Install development dependencies (if needed)
npm install --only=dev
```

For Lambda deployment, make sure to include only necessary dependencies:

```bash
# Change to the Lambda package directory
cd lambda-package-dir

# Install only production dependencies
npm install --production
```

## Managing Dependencies for Lambda

Lambda functions have a maximum deployment package size limit. To optimize the package size:

1. **Include only necessary dependencies**: Keep the Lambda package as small as possible by only including dependencies that are actually used by the Lambda function.

2. **Use the `package.json` file in your Lambda package directory**:
   ```json
   {
     "dependencies": {
       "@supabase/supabase-js": "^2.39.0",
       "axios": "^1.6.2",
       "dotenv": "^16.3.1",
       "googleapis": "^129.0.0",
       "winston": "^3.11.0"
     }
   }
   ```

3. **Exclude development dependencies** by using the `--production` flag when installing:
   ```bash
   npm install --production
   ```

## Upgrading Dependencies

Before deploying to AWS, it's recommended to check for and upgrade any outdated dependencies:

```bash
# Check for outdated packages
npm outdated

# Update all dependencies to their latest versions
npm update

# For major version updates (use with caution)
npx npm-check-updates -u
npm install
```

## Dependencies for Terraform

If you're using Terraform for infrastructure as code, make sure you have the following installed:

1. **Terraform CLI**: Version 1.0.0 or later
2. **AWS CLI**: Version 2.0.0 or later

Install them using:

```bash
# Install Terraform on macOS
brew install terraform

# Install Terraform on Linux
wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform

# Install AWS CLI
pip install awscli
```

## Dependency Security

Before deploying to AWS, check for security vulnerabilities in your dependencies:

```bash
# Check for vulnerable dependencies
npm audit

# Fix vulnerabilities (if possible)
npm audit fix

# Fix vulnerabilities that require major version upgrades (use with caution)
npm audit fix --force
```

## Lambda Layer Dependencies

Consider using Lambda Layers for common dependencies to reduce deployment package size:

1. **Create a Lambda Layer package**:
   ```bash
   mkdir -p nodejs/node_modules
   cd nodejs
   npm install @supabase/supabase-js googleapis winston
   cd ..
   zip -r layer.zip nodejs
   ```

2. **Deploy the Lambda Layer**:
   ```bash
   aws lambda publish-layer-version \
     --layer-name "bland-ai-mcp-common-deps" \
     --description "Common dependencies for Bland.AI MCP Lambda functions" \
     --compatible-runtimes nodejs18.x \
     --zip-file fileb://layer.zip
   ```

3. **Reference the Layer in your Lambda function**:
   ```bash
   aws lambda update-function-configuration \
     --function-name bland-ai-mcp-call-updater \
     --layers arn:aws:lambda:$AWS_REGION:$ACCOUNT_ID:layer:bland-ai-mcp-common-deps:1
   ```

## Development vs. Production Dependencies

When deploying to AWS, it's important to distinguish between development and production dependencies:

1. **Development dependencies**: 
   - Used for testing, linting, and local development
   - Should not be included in production builds
   - Example: `nodemon`, `jest`, `chai`, `supertest`

2. **Production dependencies**:
   - Required for the application to run in production
   - Should be included in the deployment package
   - Example: `express`, `aws-sdk`, `winston`

Make sure to install only production dependencies for AWS deployment:

```bash
npm install --production
```

## Dependency Maintenance

To keep your dependencies secure and up-to-date:

1. **Regularly update dependencies**:
   ```bash
   npm update
   ```

2. **Check for security vulnerabilities**:
   ```bash
   npm audit
   ```

3. **Use a dependency management tool** like Dependabot to automate updates

4. **Lock dependency versions** using package-lock.json:
   ```bash
   npm ci
   ```

5. **Document any specific version requirements** in your project documentation 