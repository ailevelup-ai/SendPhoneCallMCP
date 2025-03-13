/**
 * Script to package Lambda function for deployment
 * 
 * Usage: node infra/scripts/package-lambda.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

// Configuration
const rootDir = path.resolve(__dirname, '../..');
const deploymentDir = path.join(rootDir, 'infra', 'deployment');
const tempDir = path.join(deploymentDir, 'lambda-temp');
const outputZip = path.join(deploymentDir, 'lambda-call-updater.zip');

// Files to include in the Lambda package
const filesToInclude = [
  'lambda-call-updater.js',
  'google-sheets-logging.js',
  'db.js',
  'package.json',
  'package-lock.json'
];

// Directories to include in the Lambda package
const dirsToInclude = [
  'utils'
];

// Create color formatting for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Helper functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  let prefix = '';
  
  switch(type) {
    case 'info':
      prefix = `${colors.blue}[INFO]${colors.reset}`;
      break;
    case 'success':
      prefix = `${colors.green}[SUCCESS]${colors.reset}`;
      break;
    case 'warning':
      prefix = `${colors.yellow}[WARNING]${colors.reset}`;
      break;
    case 'error':
      prefix = `${colors.red}[ERROR]${colors.reset}`;
      break;
  }
  
  console.log(`${prefix} ${message}`);
}

function createDirectories() {
  log('Creating deployment directories...');
  
  // Create deployment directory if it doesn't exist
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }
  
  // Create temp directory for packaging
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });
  
  // Create nested directories
  dirsToInclude.forEach(dir => {
    const dirPath = path.join(tempDir, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
  
  log('Directories created successfully.', 'success');
}

function copyFiles() {
  log('Copying Lambda function files...');
  
  // Copy individual files
  filesToInclude.forEach(file => {
    const sourcePath = path.join(rootDir, file);
    const destPath = path.join(tempDir, file);
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      log(`Copied ${file}`);
    } else {
      log(`File not found: ${file}`, 'warning');
    }
  });
  
  // Copy directories
  dirsToInclude.forEach(dir => {
    const sourceDir = path.join(rootDir, dir);
    const destDir = path.join(tempDir, dir);
    
    if (fs.existsSync(sourceDir)) {
      copyDirectory(sourceDir, destDir);
      log(`Copied directory ${dir}`);
    } else {
      log(`Directory not found: ${dir}`, 'warning');
    }
  });
  
  log('Files copied successfully.', 'success');
}

function copyDirectory(source, destination) {
  // Get all files and directories in the source directory
  const entries = fs.readdirSync(source, { withFileTypes: true });
  
  // Create the destination directory if it doesn't exist
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }
  
  // Copy each entry
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    
    if (entry.isDirectory()) {
      // Recursively copy subdirectory
      copyDirectory(sourcePath, destPath);
    } else {
      // Copy file
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

function installDependencies() {
  log('Installing production dependencies...');
  
  try {
    execSync('npm ci --production', { 
      cwd: tempDir, 
      stdio: 'inherit' 
    });
    log('Dependencies installed successfully.', 'success');
  } catch (error) {
    log(`Failed to install dependencies: ${error.message}`, 'error');
    process.exit(1);
  }
}

function createZipPackage() {
  log('Creating Lambda deployment package...');
  
  // Delete existing zip file if it exists
  if (fs.existsSync(outputZip)) {
    fs.unlinkSync(outputZip);
  }
  
  // Create a file to stream archive data to
  const output = fs.createWriteStream(outputZip);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });
  
  // Listen for all archive data to be written
  output.on('close', function() {
    const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
    log(`Lambda deployment package created: ${outputZip} (${sizeInMB} MB)`, 'success');
    cleanupTempDirectory();
  });
  
  // Catch warnings and errors
  archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
      log(`Warning: ${err.message}`, 'warning');
    } else {
      log(`Error: ${err.message}`, 'error');
      throw err;
    }
  });
  
  archive.on('error', function(err) {
    log(`Error: ${err.message}`, 'error');
    throw err;
  });
  
  // Pipe archive data to the file
  archive.pipe(output);
  
  // Add the entire directory contents to the archive
  archive.directory(tempDir, false);
  
  // Finalize the archive
  archive.finalize();
}

function cleanupTempDirectory() {
  log('Cleaning up temporary directory...');
  
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    log('Temporary directory removed.', 'success');
  }
}

// Main execution
function main() {
  console.log('\n====================================');
  console.log('  LAMBDA DEPLOYMENT PACKAGE BUILDER  ');
  console.log('====================================\n');
  
  try {
    createDirectories();
    copyFiles();
    installDependencies();
    createZipPackage();
  } catch (error) {
    log(`Packaging failed: ${error.message}`, 'error');
    cleanupTempDirectory();
    process.exit(1);
  }
}

// Run the script
main(); 