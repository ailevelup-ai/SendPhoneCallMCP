/**
 * Lambda function to retrieve available voice options
 */

const { buildResponse } = require('./lib/api-response');

/**
 * List of available voice options with their properties
 */
const AVAILABLE_VOICES = [
  {
    id: 'alloy',
    name: 'Alloy',
    gender: 'neutral',
    description: 'Versatile neutral voice with medium range',
    isDefault: true
  },
  {
    id: 'echo',
    name: 'Echo',
    gender: 'male',
    description: 'Male voice with a deeper tone',
    isDefault: false
  },
  {
    id: 'fable',
    name: 'Fable',
    gender: 'female',
    description: 'Female voice with a warmer tone',
    isDefault: false
  },
  {
    id: 'onyx',
    name: 'Onyx',
    gender: 'male',
    description: 'Deep and authoritative male voice',
    isDefault: false
  },
  {
    id: 'nova',
    name: 'Nova',
    gender: 'female',
    description: 'Bright female voice with higher pitch',
    isDefault: false
  },
  {
    id: 'shimmer',
    name: 'Shimmer',
    gender: 'female',
    description: 'Clear and expressive female voice',
    isDefault: false
  }
];

/**
 * Lambda handler to get available voice options
 */
exports.handler = async (event) => {
  try {
    console.log('Getting voice options');
    
    // Return the list of available voices
    return buildResponse(200, AVAILABLE_VOICES);
  } catch (error) {
    console.error('Error getting voice options:', error);
    return buildResponse(500, { message: 'Error retrieving voice options' });
  }
}; 