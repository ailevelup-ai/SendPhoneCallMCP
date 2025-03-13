// Content Moderation Service for ailevelup.AI MCP Wrapper
const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Content categories to check for
 */
const CONTENT_CATEGORIES = {
  MALICIOUS: 'malicious',
  OFFENSIVE: 'offensive',
  INAPPROPRIATE: 'inappropriate',
  LEGAL_RISK: 'legal_risk',
  SPAM: 'spam',
  SCAM: 'scam',
  SAFE: 'safe'
};

/**
 * Main function to check if content is safe
 * @param {Object} callParams - The call parameters from the API request
 * @returns {Object} - Result with moderation status and details
 */
async function moderateContent(callParams) {
  try {
    // Extract relevant content to moderate
    const contentToModerate = extractModerateableContent(callParams);
    
    // Skip moderation if no content to moderate
    if (!contentToModerate || contentToModerate.trim() === '') {
      return {
        isAllowed: true,
        category: CONTENT_CATEGORIES.SAFE,
        reason: 'No content to moderate',
        score: 0,
        moderationId: generateModerationId()
      };
    }
    
    // First use OpenAI's Moderation API for quick filtering
    const initialModeration = await openai.moderations.create({
      input: contentToModerate
    });
    
    // If OpenAI moderation flags content, return result immediately
    if (initialModeration.results[0].flagged) {
      const categories = initialModeration.results[0].categories;
      const categoryScores = initialModeration.results[0].category_scores;
      
      // Find highest scoring category
      let highestCategory = null;
      let highestScore = 0;
      
      for (const [category, flagged] of Object.entries(categories)) {
        if (flagged && categoryScores[category] > highestScore) {
          highestCategory = category;
          highestScore = categoryScores[category];
        }
      }
      
      return {
        isAllowed: false,
        category: mapOpenAICategoryToInternal(highestCategory),
        reason: `Content flagged by moderation API: ${highestCategory}`,
        score: highestScore,
        moderationId: generateModerationId()
      };
    }
    
    // For more nuanced checking, use GPT-4o-mini
    return await checkWithGPT4oMini(contentToModerate);
  } catch (error) {
    console.error('Error in content moderation:', error);
    
    // If moderation fails, default to allowing the content but log the error
    return {
      isAllowed: true,
      category: CONTENT_CATEGORIES.SAFE,
      reason: 'Moderation service error, proceeding with caution',
      error: error.message,
      moderationId: generateModerationId()
    };
  }
}

/**
 * Extract all relevant content from call parameters that should be moderated
 * @param {Object} callParams - The call parameters
 * @returns {String} - Combined content for moderation
 */
function extractModerateableContent(callParams) {
  const contentPieces = [
    callParams.task || '',
    callParams.first_sentence || '',
    callParams.voice !== undefined ? `Using voice: ${callParams.voice}` : '',
  ];
  
  // Handle dynamic data if present
  if (callParams.dynamic_data && Array.isArray(callParams.dynamic_data)) {
    callParams.dynamic_data.forEach(item => {
      // Stringify any dynamic data objects
      contentPieces.push(typeof item === 'object' ? JSON.stringify(item) : String(item));
    });
  }
  
  // Handle keywords if present
  if (callParams.keywords && Array.isArray(callParams.keywords)) {
    contentPieces.push(`Keywords: ${callParams.keywords.join(', ')}`);
  }
  
  return contentPieces.filter(piece => piece && piece.trim() !== '').join('\n');
}

/**
 * Check content using GPT-4o-mini for deeper analysis
 * @param {String} content - Content to check
 * @returns {Object} - Moderation results
 */
async function checkWithGPT4oMini(content) {
  const systemPrompt = `You are a content moderation assistant. Your task is to analyze the following content which will be used in an automated phone call.
  
Evaluate whether this content would be inappropriate, malicious, potentially harmful, or illegal when used in an automated phone call.
  
Categories for rejection:
1. Malicious content (threats, harassment)
2. Offensive content (hate speech, slurs, extreme vulgarity)
3. Inappropriate content (sexual content, adult content, graphic violence)
4. Legal risk (impersonation of government/law enforcement, fraud, phishing)
5. Spam (unsolicited marketing)
6. Scam (deceptive practices, false claims)

Provide a JSON response with these fields:
{
  "isAllowed": boolean,
  "category": "safe" or one of the categories above in lowercase,
  "reason": string explanation,
  "confidence": number between 0-1
}`;

  const userPrompt = `Content to evaluate for an automated phone call:
  
${content}

Analyze carefully and provide your evaluation in JSON format.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });
    
    // Parse the JSON response
    const result = JSON.parse(response.choices[0].message.content);
    
    // Add moderation ID for tracking
    result.moderationId = generateModerationId();
    
    // Rename confidence to score for consistency
    result.score = result.confidence;
    delete result.confidence;
    
    return result;
  } catch (error) {
    console.error('Error with GPT-4o-mini moderation:', error);
    
    // If GPT analysis fails, default to allowing with a warning
    return {
      isAllowed: true,
      category: CONTENT_CATEGORIES.SAFE,
      reason: 'GPT moderation failed, proceeding with caution',
      score: 0,
      error: error.message,
      moderationId: generateModerationId()
    };
  }
}

/**
 * Map OpenAI moderation categories to internal categories
 * @param {String} openaiCategory - Category from OpenAI
 * @returns {String} - Internal category
 */
function mapOpenAICategoryToInternal(openaiCategory) {
  const mapping = {
    'harassment': CONTENT_CATEGORIES.MALICIOUS,
    'harassment/threatening': CONTENT_CATEGORIES.MALICIOUS,
    'hate': CONTENT_CATEGORIES.OFFENSIVE,
    'hate/threatening': CONTENT_CATEGORIES.OFFENSIVE,
    'self-harm': CONTENT_CATEGORIES.INAPPROPRIATE,
    'self-harm/intent': CONTENT_CATEGORIES.INAPPROPRIATE,
    'self-harm/instructions': CONTENT_CATEGORIES.INAPPROPRIATE,
    'sexual': CONTENT_CATEGORIES.INAPPROPRIATE,
    'sexual/minors': CONTENT_CATEGORIES.INAPPROPRIATE,
    'violence': CONTENT_CATEGORIES.INAPPROPRIATE,
    'violence/graphic': CONTENT_CATEGORIES.INAPPROPRIATE
  };
  
  return mapping[openaiCategory] || CONTENT_CATEGORIES.INAPPROPRIATE;
}

/**
 * Generate a unique moderation ID for tracking
 * @returns {String} - Unique ID
 */
function generateModerationId() {
  return `mod_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Log moderation results for auditing and improvement
 * @param {Object} result - Moderation result
 * @param {Object} callParams - Original call parameters
 * @param {String} userId - User ID
 */
async function logModerationResult(result, callParams, userId) {
  // This would typically log to a database or other persistent storage
  console.log('Moderation result:', {
    timestamp: new Date().toISOString(),
    userId,
    moderationId: result.moderationId,
    isAllowed: result.isAllowed,
    category: result.category,
    reason: result.reason,
    score: result.score,
    phone: maskPhoneNumber(callParams.phone_number),
    taskPreview: truncate(callParams.task, 100)
  });
  
  // In a real implementation, you would store this in a database
}

/**
 * Mask a phone number for privacy in logs
 * @param {String} phoneNumber - Phone number to mask
 * @returns {String} - Masked phone number
 */
function maskPhoneNumber(phoneNumber) {
  if (!phoneNumber) return 'N/A';
  const cleaned = phoneNumber.replace(/\D/g, '');
  if (cleaned.length <= 4) return cleaned;
  return `${cleaned.slice(0, 3)}****${cleaned.slice(-4)}`;
}

/**
 * Truncate a string to a specific length
 * @param {String} str - String to truncate
 * @param {Number} length - Max length
 * @returns {String} - Truncated string
 */
function truncate(str, length) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

module.exports = {
  moderateContent,
  CONTENT_CATEGORIES,
  logModerationResult
};
