# SendPhoneCall MCP Server

This repository contains the MCP (Model Control Protocol) server implementation for the SendPhoneCall service, which enables AI-powered phone calls.

## Prerequisites

- Node.js (v14 or higher)
- Supabase account and project
- Environment variables set up (see below)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
PORT=3040
NODE_ENV=development
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_key
BYPASS_MCP_AUTH=true  # Only for development
```

## Database Setup

There are three ways to set up the necessary database tables in Supabase:

### Option 1: Execute SQL in Supabase SQL Editor
1. Create a Supabase project if you haven't already
2. Go to the SQL Editor in your Supabase dashboard
3. Copy the contents of `direct-supabase-setup.sql` and execute it in the SQL Editor

### Option 2: Use the direct setup script
```bash
node direct-setup-database.js
```

### Option 3: Use the function-based setup (requires SQL functions to be set up first)
1. Execute the SQL in `supabase-setup.sql` in the Supabase SQL Editor to create the necessary functions
2. Run the database setup script:
```bash
node setup-database.js
```

Regardless of the method used, this will create the following tables:
- `user_settings`: Stores user preferences for phone calls
- `call_history`: Records history of phone calls made
- `credits`: Manages user credit balance for making calls

## Starting the Server

Before starting the server, make sure no other instance is running on port 3040:
```bash
# Kill any existing server process
pkill -f "node server.js"
```

Then start the server:
```bash
node server.js
```

For development with authentication bypass:
```bash
NODE_ENV=development BYPASS_MCP_AUTH=true node server.js
```

To run in the background:
```bash
NODE_ENV=development BYPASS_MCP_AUTH=true node server.js &
```

## API Endpoints

### Health Check
```
GET /health
```

### MCP API
```
POST /api/v1/mcp
```

## Available Tools

The MCP server provides the following tools:

### getModelOptions
Returns available AI model options for phone calls.

### getVoiceOptions
Returns available voice options for phone calls.

### updateCallPreferences
Updates a user's default preferences for phone calls.

Parameters:
- `defaultVoice`: Default voice to use (string)
- `defaultModel`: Default AI model to use (string)
- `defaultTemperature`: Default temperature setting (0.0-1.0)
- `defaultFromNumber`: Default phone number to make calls from (E.164 format)
- `defaultVoicemailAction`: Action to take when voicemail is detected (leave_message, hang_up, retry_later)

### makePhoneCall
Initiates a phone call.

Parameters:
- `toNumber`: Phone number to call (E.164 format)
- `fromNumber`: Phone number to call from (E.164 format)
- `voiceId`: Voice to use
- `modelId`: AI model to use
- `temperature`: Temperature setting (0.0-1.0)
- `instructions`: Instructions for the AI

## Testing the API

Initialize a session:
```bash
curl -X POST http://localhost:3040/api/v1/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"clientName":"test-client","clientVersion":"1.0.0"},"id":1}'
```

Execute a tool (example: getModelOptions):
```bash
curl -X POST http://localhost:3040/api/v1/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/execute","params":{"name":"getModelOptions","arguments":{}},"id":2}'
```

## Implementation Plan Progress

See `mcp-implementation-plan-progress.md` for the current status of the implementation plan.

## Troubleshooting

### Missing Dependencies
If you see errors about missing modules, install them:
```bash
npm install jsonschema
```

### Port Already in Use
If you see "Error: listen EADDRINUSE: address already in use :::3040", kill the existing process:
```bash
pkill -f "node server.js"
```

### Database Connection Issues
If the server fails to connect to the database, verify your `.env` file contains the correct Supabase URL and key.

### Database Tables Not Found
If you encounter "relation does not exist" errors, run the database setup using the direct method:
```bash
node direct-setup-database.js
``` 