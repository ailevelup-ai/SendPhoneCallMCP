# Bland.AI MCP - Management Control Panel

A comprehensive management control panel for the Bland.AI phone call service. This application allows users to make automated AI phone calls, track call history, and manage credits.

## Features

- **User Authentication**: Create accounts, login, and manage API keys
- **Credits System**: View and top up your credits
- **Call History**: View detailed call history with filtering and sorting
- **Call Details**: See detailed information about each call, including transcripts and recordings
- **Polling System**: Automatic updates from Bland.AI to keep call data current
- **Google Sheets Integration**: Log all calls to Google Sheets for easy export and analysis
- **Supabase Integration**: Secure database storage with PostgreSQL
- **Modern UI**: Clean, responsive front-end built with React

## Tech Stack

- **Backend**: Node.js with Express
- **Frontend**: React with React Router
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Custom auth with Supabase
- **Logging**: Google Sheets API
- **Storage**: Supabase Storage
- **Hosting**: Any platform that supports Node.js

## Prerequisites

- Node.js 14+ and npm
- Supabase account and project
- Google Cloud Platform account with Google Sheets API enabled
- Bland.AI API key

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/ailevelup-ai/SendPhoneCallMCP.git
cd SendPhoneCallMCP
```

### 2. Install dependencies

```bash
# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 3. Set up environment variables

Create a `.env` file in the root directory with the following variables:

```
# Server configuration
PORT=3040
NODE_ENV=development

# Bland.AI API
BLAND_ENTERPRISE_API_KEY=your_bland_api_key
BLAND_ENCRYPTED_KEY=your_bland_encrypted_key
BLAND_DEFAULT_VOICE=nat
BLAND_DEFAULT_FROM_NUMBER=+15615665857
BLAND_DEFAULT_MODEL=turbo
BLAND_DEFAULT_TEMPERATURE=1
BLAND_DEFAULT_VOICEMAIL_ACTION=hangup
BLAND_ANSWERED_BY_ENABLED=true

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Sheets
GOOGLE_SHEETS_DOC_ID=your_google_sheets_doc_id
GOOGLE_SHEETS_CLIENT_EMAIL=your_google_service_account_email
GOOGLE_SHEETS_PRIVATE_KEY="your_google_service_account_private_key"
```

Create a `.env` file in the client directory:

```
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Set up Supabase database

Run the schema creation script:

```bash
node scripts/update-schema.js
```

### 5. Initialize Google Sheets

The application will automatically create and initialize the Google Sheets document on first run.

## Running the Application

### Development Mode

```bash
# Start the server
npm start

# In a separate terminal, start the client
cd client
npm start
```

The server will run on port 3040 and the client on port 3000.

### Production Mode

```bash
# Build the client
cd client
npm run build
cd ..

# Start the production server
NODE_ENV=production npm start
```

In production mode, the server will serve the React build files.

## API Endpoints

### Authentication

- `POST /api/v1/auth/register` - Register a new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/reset-api-key` - Reset API key

### Calls

- `POST /api/v1/call` - Make a new call
- `GET /api/v1/call/:callId` - Get call details
- `GET /api/v1/calls` - Get call history

### Credits

- `POST /api/v1/credits/add` - Add credits
- `GET /api/v1/credits/balance` - Get credit balance

## Polling System

The application includes two polling systems to keep call data updated:

1. **Local Polling**: A script that runs every 5 minutes to update call data
   ```bash
   node poll-call-updates.js
   ```

2. **AWS Lambda Function**: A function that can be deployed to AWS Lambda to poll for updates
   ```bash
   # Deploy to AWS Lambda (requires AWS CLI configured)
   zip -r lambda-function.zip lambda-call-updater.js node_modules
   aws lambda create-function --function-name bland-ai-call-updater --zip-file fileb://lambda-function.zip --handler lambda-call-updater.handler --runtime nodejs14.x --role your-lambda-execution-role-arn
   ```

## License

[MIT](LICENSE)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request 