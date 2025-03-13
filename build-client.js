/**
 * Script to build the React client and copy it to the server's public directory
 */
const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

console.log('Building React client...');

try {
  // Navigate to client directory
  process.chdir(path.join(__dirname, 'client'));
  
  // Install dependencies if node_modules doesn't exist
  if (!fs.existsSync(path.join(__dirname, 'client', 'node_modules'))) {
    console.log('Installing client dependencies...');
    execSync('npm install', { stdio: 'inherit' });
  }
  
  // Build the React app
  console.log('Running build command...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Navigate back to root
  process.chdir(__dirname);
  
  // Create public directory if it doesn't exist
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }
  
  // Remove old build files
  console.log('Cleaning public directory...');
  fs.emptyDirSync(publicDir);
  
  // Copy new build files
  console.log('Copying build files to public directory...');
  fs.copySync(
    path.join(__dirname, 'client', 'build'),
    publicDir
  );
  
  console.log('Client build completed successfully!');
  console.log(`Files copied to: ${publicDir}`);
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
} 