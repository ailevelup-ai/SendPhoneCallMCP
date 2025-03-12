# SendPhoneCallMCP

A middleware wrapper for Bland.AI enterprise API that provides phone call integration, Google Sheets logging, analytics dashboard, and administrative features.

## Features

- **Phone Call Integration**: Interface with Bland.AI Enterprise API for phone call capabilities
- **Google Sheets Logging**: Automatic logging of all call data to Google Sheets
- **Analytics Dashboard**: Real-time monitoring of call metrics and usage
- **Audit Logging**: Comprehensive audit trail of all system activities
- **User Management**: Admin controls for managing users and permissions
- **Credit System**: Track and manage API usage and credits

## Setup

### Prerequisites
- Node.js (v14+)
- NPM or Yarn
- Google Cloud Platform account with Sheets API enabled
- Bland.AI Enterprise API key
- Supabase account for database

### Installation

1. Clone this repository
```bash
git clone https://github.com/yourusername/SendPhoneCallMCP.git
cd SendPhoneCallMCP
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
   - Copy `.env.example` to `.env`
   - Fill in all required API keys and configuration values

4. Set up Google Sheets integration
   - Create a service account in Google Cloud Console
   - Grant the service account access to your Google Sheets document
   - Add the service account credentials to your `.env` file

5. Start the server
```bash
npm start
```

## Environment Variables

See `.env.example` for all required environment variables.

## API Endpoints

- `POST /api/v1/call`: Send a phone call
- `GET /api/v1/calls`: Get call history
- `GET /api/v1/audit/logs`: Get audit logs (admin only)
- `GET /api/v1/dashboard`: Get dashboard metrics (admin only)

## Logging

Call data is automatically logged to:
- Google Sheets (for easy viewing and reporting)
- Database (for querying and analytics)
- Local log files (for backup and debugging)

## License

Private - All rights reserved 