const request = require('supertest');
const app = require('../../server');

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock session storage
const mockSessions = new Map();
jest.mock('../../mcp/session', () => ({
  getSessions: () => mockSessions,
  createSession: jest.fn((clientInfo) => {
    const sessionId = 'test-session-id';
    mockSessions.set(sessionId, {
      id: sessionId,
      clientInfo,
      createdAt: new Date(),
      lastAccessed: new Date()
    });
    return sessionId;
  }),
  getSession: jest.fn((sessionId) => mockSessions.get(sessionId)),
  refreshSession: jest.fn((sessionId) => {
    const session = mockSessions.get(sessionId);
    if (session) {
      session.lastAccessed = new Date();
    }
    return session;
  })
}));

// Mock authentication middleware
jest.mock('../../mcp/middleware/auth', () => ({
  authenticateMcp: (req, res, next) => {
    req.userId = 'test-user-id';
    req.user = {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'user',
      api_key: 'test-api-key'
    };
    next();
  }
}));

// Mock tools execution
jest.mock('../../mcp/tools', () => ({
  registerTools: jest.fn(),
  getAvailableTools: jest.fn().mockReturnValue([
    {
      name: 'getModelOptions',
      description: 'Get available AI model options for phone calls',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'getVoiceOptions',
      description: 'Get available voice options for phone calls',
      parameters: { type: 'object', properties: {} }
    }
  ]),
  executeToolById: jest.fn().mockImplementation((params) => {
    if (params.name === 'getModelOptions') {
      return Promise.resolve([
        { id: 'model1', name: 'Model 1' },
        { id: 'model2', name: 'Model 2' }
      ]);
    } else if (params.name === 'getVoiceOptions') {
      return Promise.resolve([
        { id: 'voice1', name: 'Voice 1' },
        { id: 'voice2', name: 'Voice 2' }
      ]);
    } else {
      return Promise.reject(new Error(`Tool not found: ${params.name}`));
    }
  })
}));

describe('MCP API Integration Tests', () => {
  describe('POST /api/v1/mcp', () => {
    test('should initialize a session', async () => {
      const response = await request(app)
        .post('/api/v1/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            clientName: 'test-client',
            clientVersion: '1.0.0'
          },
          id: 1
        });
      
      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(1);
      expect(response.body.result).toHaveProperty('sessionId');
      expect(response.body.result).toHaveProperty('capabilities');
      expect(response.body.result.capabilities).toHaveProperty('tools');
    });
    
    test('should execute a tool', async () => {
      const response = await request(app)
        .post('/api/v1/mcp')
        .set('Authorization', 'Bearer test-session-id')
        .send({
          jsonrpc: '2.0',
          method: 'tools/execute',
          params: {
            name: 'getModelOptions',
            arguments: {}
          },
          id: 2
        });
      
      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(2);
      expect(response.body.result).toBeInstanceOf(Array);
      expect(response.body.result.length).toBe(2);
      expect(response.body.result[0]).toHaveProperty('id');
      expect(response.body.result[0]).toHaveProperty('name');
    });
    
    test('should return error for invalid method', async () => {
      const response = await request(app)
        .post('/api/v1/mcp')
        .set('Authorization', 'Bearer test-session-id')
        .send({
          jsonrpc: '2.0',
          method: 'invalid_method',
          params: {},
          id: 3
        });
      
      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(3);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBeDefined();
      expect(response.body.error.message).toBeDefined();
    });
  });
}); 