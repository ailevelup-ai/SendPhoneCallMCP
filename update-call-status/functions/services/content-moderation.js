/**
 * Content Moderation Service
 * 
 * Provides text moderation functionalities
 */

/**
 * Checks if text contains potentially harmful content
 * 
 * @param {string} text - The text to check for harmful content
 * @returns {Promise<{isAllowed: boolean, reason: string|null}>} Result of moderation check
 */
const moderateText = async (text) => {
  try {
    // In a real implementation, this would call a content moderation API
    // For now, we're implementing a simple check for demo purposes
    
    // List of harmful words to check for
    const harmfulTerms = [
      'bomb', 'kill', 'murder', 'attack', 'terrorist', 
      'suicide', 'porn', 'explicit', 'hack', 'illegal',
      'drug', 'cocaine', 'heroin'
    ];
    
    // Check for harmful terms
    const lowerText = text.toLowerCase();
    const foundTerms = harmfulTerms.filter(term => lowerText.includes(term));
    
    if (foundTerms.length > 0) {
      return {
        isAllowed: false,
        reason: `Text contains potentially harmful content: ${foundTerms.join(', ')}`
      };
    }
    
    return {
      isAllowed: true,
      reason: null
    };
  } catch (error) {
    console.error('Error in content moderation:', error);
    // Default to allowing the content in case of error
    return {
      isAllowed: true,
      reason: null
    };
  }
};

module.exports = {
  moderateText
}; 