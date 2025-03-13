const { JSONSchemaValidator } = require('../../mcp/lib/validators');
const { executeToolById } = require('../../mcp/tools');

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis()
  }
}));

jest.mock('../../config/redis', () => ({
  redisClient: {
    isReady: false
  }
}));

describe('MCP Server', () => {
  describe('JSON Schema Validator', () => {
    test('should validate valid parameters', () => {
      const validator = new JSONSchemaValidator();
      const schema = { 
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      };
      
      const params = { name: 'Test' };
      const result = validator.validate(params, schema);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject invalid parameters', () => {
      const validator = new JSONSchemaValidator();
      const schema = { 
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      };
      
      const params = { name: 123 }; // name should be string
      const result = validator.validate(params, schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('Tool Execution', () => {
    test('should reject execution with missing tool name', async () => {
      await expect(executeToolById({}, 'test-session-id')).rejects.toThrow('Tool name is required');
    });
    
    test('should reject execution with invalid tool name', async () => {
      await expect(executeToolById({ name: 'nonExistentTool', arguments: {} }, 'test-session-id'))
        .rejects.toThrow('Tool not found: nonExistentTool');
    });
  });
}); 