# GitHub Repository Setup Guide

Follow these steps to create a new GitHub repository and back up your code.

## 1. Create a New Repository on GitHub

1. Log in to your GitHub account
2. Click the "+" icon in the top right corner, then select "New repository"
3. Enter "SendPhoneCallMCP" as the repository name
4. Add a description: "MCP Wrapper for Bland.AI phone call integration with Google Sheets logging, analytics, and admin dashboard"
5. Choose "Private" as the repository visibility
6. Do NOT initialize the repository with a README, .gitignore, or license
7. Click "Create repository"

## 2. Prepare Your Local Repository

Run these commands in your terminal from the project directory:

```bash
# Initialize git repository if not already done
git init

# Add all files to staging, excluding those in .gitignore
git add .

# Initial commit
git commit -m "Initial commit: Bland.AI MCP Wrapper project"

# Add GitHub as remote origin (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/SendPhoneCallMCP.git

# Push to GitHub
git push -u origin main
```

## 3. Verify Your Repository Security

Make sure these sensitive files are NOT pushed to GitHub:
- `.env` file with API keys and secrets
- `candystripersheets-0fb49c8d3912.json` (Google Sheets credentials)
- Any other files containing credentials, API keys, or secrets

The `.gitignore` file should already be configured to exclude these files, but double-check the GitHub repository after pushing to ensure they were not included.

## 4. Additional Repository Setup (Optional)

Consider setting up:
- Branch protection rules for the main branch
- Issue templates
- GitHub Actions for CI/CD

## 5. Clone the Repository on Another Computer (if needed)

```bash
git clone https://github.com/YOUR_USERNAME/SendPhoneCallMCP.git
cd SendPhoneCallMCP
npm install
```

Remember to set up your `.env` file on the new computer by copying values from your original setup. 