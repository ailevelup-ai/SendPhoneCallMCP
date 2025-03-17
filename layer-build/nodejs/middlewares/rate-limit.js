const rateLimit = require('express-rate-limit');

function limitByUser(maxRequests, windowMinutes) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: {
      error: `Too many requests. Please try again after ${windowMinutes} minutes.`
    },
    keyGenerator: function (req) {
      // Use user ID if available, otherwise use IP
      return req.user ? req.user.id : req.ip;
    }
  });
}

module.exports = {
  limitByUser
}; 