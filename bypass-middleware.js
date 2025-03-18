// Bypass middleware for development testing
const bypassAuth = (req, res, next) => {
  console.log('BYPASS AUTH MIDDLEWARE ACTIVE');
  console.log('Request headers:', req.headers);
  console.log('Request path:', req.path);
  console.log('Request method:', req.method);
  console.log('Request body:', req.body);
  
  // Inject fake user data
  req.user = {
    id: 'dev-user-id',
    email: 'dev@example.com',
    role: 'admin',
    api_key: 'dev-api-key',
    permissions: ['admin']
  };
  
  // Proceed to the next middleware
  next();
};

module.exports = bypassAuth; 