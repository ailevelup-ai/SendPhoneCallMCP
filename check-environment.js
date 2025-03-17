#!/usr/bin/env node

/**
 * Environment Verification Script
 * This script checks the environment configuration for the deployment process
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Helper function to run commands and return the output
function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error(`${colors.red}Error running command: ${command}${colors.reset}`);
    console.error(`${colors.yellow}${error.message}${colors.reset}`);
    return null;
  }
}

// Check if a command exists in the system
function commandExists(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Check if AWS CLI is installed and correctly configured
function checkAwsCli() {
  console.log(`\n${colors.cyan}Checking AWS CLI...${colors.reset}`);
  
  if (!commandExists('aws')) {
    console.error(`${colors.red}AWS CLI is not installed or not in PATH${colors.reset}`);
    console.log('Please install the AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html');
    return false;
  }
  
  console.log(`${colors.green}✓ AWS CLI is installed${colors.reset}`);
  
  // Check AWS CLI version
  const versionOutput = runCommand('aws --version');
  if (versionOutput) {
    console.log(`AWS CLI version: ${versionOutput}`);
  }
  
  // Check AWS credentials
  try {
    const credentials = runCommand('aws sts get-caller-identity --query "Account" --output text');
    if (credentials) {
      console.log(`${colors.green}✓ AWS credentials are configured (Account: ${credentials})${colors.reset}`);
      return true;
    } else {
      console.error(`${colors.red}Failed to verify AWS credentials${colors.reset}`);
      console.log('Please run "aws configure" to set up your credentials');
      return false;
    }
  } catch (error) {
    console.error(`${colors.red}Failed to verify AWS credentials: ${error.message}${colors.reset}`);
    console.log('Please run "aws configure" to set up your credentials');
    return false;
  }
}

// Check if Node.js is installed and its version
function checkNodeJs() {
  console.log(`\n${colors.cyan}Checking Node.js...${colors.reset}`);
  
  try {
    const version = runCommand('node --version');
    console.log(`${colors.green}✓ Node.js is installed (Version: ${version})${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}Node.js is not installed or not in PATH${colors.reset}`);
    return false;
  }
}

// Check if the required environment files exist
function checkEnvFiles() {
  console.log(`\n${colors.cyan}Checking environment files...${colors.reset}`);
  
  const requiredEnvFiles = ['.env.staging', '.env.production'];
  let allFilesExist = true;
  
  for (const file of requiredEnvFiles) {
    if (fs.existsSync(file)) {
      console.log(`${colors.green}✓ ${file} exists${colors.reset}`);
    } else {
      console.error(`${colors.red}✗ ${file} is missing${colors.reset}`);
      allFilesExist = false;
    }
  }
  
  return allFilesExist;
}

// Check if the required deployment scripts exist
function checkDeploymentScripts() {
  console.log(`\n${colors.cyan}Checking deployment scripts...${colors.reset}`);
  
  const requiredScripts = [
    'deploy-to-staging.sh',
    'deploy-to-production.sh',
    'create-lambda-layer.sh',
    'deploy-lambda-with-index.sh',
    'tools/update-lambda-handlers.js',
    'tools/update-lambda-permissions.js',
    'tools/update-lambda-error-handling.js',
    'tools/test-lambda-functions.js',
    'tools/check-lambda-logs.js'
  ];
  
  let allScriptsExist = true;
  
  for (const script of requiredScripts) {
    if (fs.existsSync(script)) {
      // Check if script is executable
      try {
        fs.accessSync(script, fs.constants.X_OK);
        console.log(`${colors.green}✓ ${script} exists and is executable${colors.reset}`);
      } catch (error) {
        console.log(`${colors.yellow}! ${script} exists but is not executable${colors.reset}`);
        console.log(`  Run: chmod +x ${script}`);
        allScriptsExist = false;
      }
    } else {
      console.error(`${colors.red}✗ ${script} is missing${colors.reset}`);
      allScriptsExist = false;
    }
  }
  
  return allScriptsExist;
}

// Check API Gateway status for the given environment
function checkApiGateway(environment = 'staging', region = 'us-east-1') {
  console.log(`\n${colors.cyan}Checking API Gateway for ${environment}...${colors.reset}`);
  
  const apiName = `ailevelup-phone-call-mcp-${environment}-api`;
  
  try {
    const apiList = runCommand(`aws apigateway get-rest-apis --region ${region} --query "items[?name=='${apiName}'].{id:id,name:name}" --output json`);
    
    if (!apiList) {
      console.error(`${colors.red}Failed to query API Gateway${colors.reset}`);
      return false;
    }
    
    const apis = JSON.parse(apiList);
    
    if (apis.length === 0) {
      console.error(`${colors.red}No API Gateway found with name: ${apiName}${colors.reset}`);
      console.log(`${colors.yellow}You need to create the API Gateway before deployment${colors.reset}`);
      return false;
    }
    
    const api = apis[0];
    console.log(`${colors.green}✓ API Gateway found: ${api.name} (ID: ${api.id})${colors.reset}`);
    
    // Check if API has deployments
    const deployments = runCommand(`aws apigateway get-deployments --rest-api-id ${api.id} --region ${region} --query "items[].{id:id,description:description}" --output json`);
    
    if (!deployments) {
      console.error(`${colors.red}Failed to query API Gateway deployments${colors.reset}`);
      return false;
    }
    
    const deploymentsArray = JSON.parse(deployments);
    
    if (deploymentsArray.length === 0) {
      console.log(`${colors.yellow}! No deployments found for API Gateway${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ API Gateway has ${deploymentsArray.length} deployments${colors.reset}`);
    }
    
    return true;
  } catch (error) {
    console.error(`${colors.red}Error checking API Gateway: ${error.message}${colors.reset}`);
    return false;
  }
}

// Check Lambda functions for the given environment
function checkLambdaFunctions(environment = 'staging', region = 'us-east-1') {
  console.log(`\n${colors.cyan}Checking Lambda functions for ${environment}...${colors.reset}`);
  
  const functionPrefix = `ailevelup-phone-call-mcp-${environment}`;
  
  try {
    const functions = runCommand(`aws lambda list-functions --region ${region} --query "Functions[?starts_with(FunctionName, '${functionPrefix}')].[FunctionName]" --output text`);
    
    if (!functions) {
      console.error(`${colors.red}Failed to query Lambda functions${colors.reset}`);
      return false;
    }
    
    const functionList = functions.split('\n').filter(Boolean);
    
    if (functionList.length === 0) {
      console.error(`${colors.red}No Lambda functions found with prefix: ${functionPrefix}${colors.reset}`);
      return false;
    }
    
    console.log(`${colors.green}✓ Found ${functionList.length} Lambda functions:${colors.reset}`);
    functionList.forEach(func => {
      console.log(`  - ${func}`);
    });
    
    return true;
  } catch (error) {
    console.error(`${colors.red}Error checking Lambda functions: ${error.message}${colors.reset}`);
    return false;
  }
}

// Main function to check all components
function checkEnvironment() {
  console.log(`${colors.magenta}=================================${colors.reset}`);
  console.log(`${colors.magenta}Environment Verification Script${colors.reset}`);
  console.log(`${colors.magenta}=================================${colors.reset}`);
  
  console.log(`System: ${os.type()} ${os.release()}`);
  console.log(`Architecture: ${os.arch()}`);
  console.log(`Current directory: ${process.cwd()}`);
  
  // Run all checks
  const nodeOk = checkNodeJs();
  const awsOk = checkAwsCli();
  const envFilesOk = checkEnvFiles();
  const scriptsOk = checkDeploymentScripts();
  
  // Get environment from command line args or default to staging
  const environment = process.argv[2] || 'staging';
  const region = process.argv[3] || 'us-east-1';
  
  const apiOk = awsOk ? checkApiGateway(environment, region) : false;
  const lambdaOk = awsOk ? checkLambdaFunctions(environment, region) : false;
  
  // Summary
  console.log(`\n${colors.magenta}======== Check Summary ========${colors.reset}`);
  console.log(`${nodeOk ? colors.green : colors.red}Node.js: ${nodeOk ? 'OK' : 'FAILED'}${colors.reset}`);
  console.log(`${awsOk ? colors.green : colors.red}AWS CLI: ${awsOk ? 'OK' : 'FAILED'}${colors.reset}`);
  console.log(`${envFilesOk ? colors.green : colors.red}Environment Files: ${envFilesOk ? 'OK' : 'FAILED'}${colors.reset}`);
  console.log(`${scriptsOk ? colors.green : colors.red}Deployment Scripts: ${scriptsOk ? 'OK' : 'FAILED'}${colors.reset}`);
  console.log(`${apiOk ? colors.green : colors.red}API Gateway: ${apiOk ? 'OK' : 'FAILED'}${colors.reset}`);
  console.log(`${lambdaOk ? colors.green : colors.red}Lambda Functions: ${lambdaOk ? 'OK' : 'FAILED'}${colors.reset}`);
  
  console.log(`\n${colors.magenta}=================================${colors.reset}`);
  
  // Exit with appropriate status code
  if (nodeOk && awsOk && envFilesOk && scriptsOk && apiOk && lambdaOk) {
    console.log(`${colors.green}All checks passed! The environment is ready for deployment.${colors.reset}`);
    process.exit(0);
  } else {
    console.error(`${colors.red}Some checks failed. Please fix the issues before proceeding with deployment.${colors.reset}`);
    process.exit(1);
  }
}

// Run the main function
checkEnvironment(); 