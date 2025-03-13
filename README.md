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

1. Create a Supabase project if you haven't already
2. Execute the SQL in `supabase-setup.sql` in the Supabase SQL Editor to create the necessary functions
3. Run the database setup script:

```bash
node setup-database.js
```

This will create the following tables:
- `user_settings`: Stores user preferences for phone calls
- `call_history`: Records history of phone calls made
- `credits`: Manages user credit balance for making calls

## Starting the Server

```bash
node server.js
```

For development with authentication bypass:

```bash
NODE_ENV=development BYPASS_MCP_AUTH=true node server.js
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