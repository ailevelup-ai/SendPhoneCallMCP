# ailevelup.AI MCP Wrapper

A Mission Control Panel (MCP) wrapper for the ailevelup.AI phone call API, providing enhanced functionality, monitoring, and integration capabilities.

## Features

- Make AI phone calls using ailevelup.AI's API
- Real-time call monitoring and status updates
- Call history and transcripts
- Voice and model selection
- Integration with Google Sheets for call tracking
- Supabase database integration for data persistence
- Content moderation and safety checks
- Audit logging and monitoring
- Rate limiting and quota management
- Error handling and retry logic
- Webhook support for call status updates

## Prerequisites

1. ailevelup.AI Enterprise API key
2. Google Cloud Service Account (for Sheets integration)
3. Supabase account and project
4. Node.js 18+ and npm/yarn
5. Redis (for rate limiting)
6. PostgreSQL database

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
# API Keys
AILEVELUP_ENTERPRISE_API_KEY=your_ailevelup_enterprise_api_key
AILEVELUP_ENCRYPTED_KEY=your_ailevelup_encrypted_key

# Other configurations as listed in .env.example
```

## Installation

```bash
# Install dependencies
npm install

# Set up the database
npm run db:setup

# Start Redis
redis-server

# Start the development server
npm run dev
```

## API Documentation

### Make a Phone Call

```javascript
POST /api/v1/calls

{
  "phone_number": "+1234567890",
  "task": "Schedule an appointment for next week",
  "voice": "alloy",  // Optional, defaults to 'alloy'
  "from_number": "+1987654321",  // Optional
  "model": "turbo",  // Optional, defaults to 'turbo'
  "temperature": 0.7  // Optional, defaults to 0.7
}
```

See the [API Documentation](docs/API.md) for more endpoints and details.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

For support, email support@ailevelup.ai or open an issue in this repository. 