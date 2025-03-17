
const getRateLimit = async (userId) => {
  return { allowed: true, resetTime: null };
};

const updateRateLimit = async (userId) => {
  return true;
};

module.exports = { getRateLimit, updateRateLimit };
