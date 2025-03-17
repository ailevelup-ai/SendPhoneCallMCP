/**
 * Lambda function to retrieve available AI models
 */

const { buildResponse } = require('./lib/api-response');

/**
 * List of available models with their properties
 */
const AVAILABLE_MODELS = [
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    description: 'Most powerful model for complex tasks requiring deep understanding and reasoning',
    tokenLimit: 200000,
    isDefault: true
  },
  {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    description: 'Balanced model suitable for most use cases offering good performance',
    tokenLimit: 180000,
    isDefault: false
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    description: 'Fastest and most compact model with lower latency',
    tokenLimit: 150000,
    isDefault: false
  },
  {
    id: 'claude-instant-1.2',
    name: 'Claude Instant',
    description: 'Legacy model optimized for fast responses',
    tokenLimit: 100000,
    isDefault: false
  }
];

/**
 * Lambda handler to get available models
 */
exports.handler = async (event) => {
  try {
    console.log('Getting model options');
    
    // Return the list of available models
    return buildResponse(200, AVAILABLE_MODELS);
  } catch (error) {
    console.error('Error getting model options:', error);
    return buildResponse(500, { message: 'Error retrieving model options' });
  }
}; 