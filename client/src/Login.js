import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useSupabase } from './contexts/SupabaseContext';
import './Login.css';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const { signIn, signUp, socialSignIn } = useAuth();
  const { supabase } = useSupabase();

  const toggleMode = () => {
    setIsSignup(!isSignup);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isSignup) {
        // Check if passwords match for signup
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setIsLoading(false);
          return;
        }

        const success = await signUp(email, password);
        
        if (success) {
          // User will be automatically logged in via the signUp function
          // No need to do anything else here
          return;
        }
      } else {
        // Handle login
        const success = await signIn(email, password);
        
        if (success) {
          // Fetch the user data from localStorage that would have been set by AuthContext
          const token = localStorage.getItem('auth_token');
          const userId = localStorage.getItem('user_id');
          const userEmail = localStorage.getItem('user_email');
          const userRole = localStorage.getItem('user_role');
          
          // Notify the parent component about successful login
          onLoginSuccess({
            token,
            id: userId,
            email: userEmail,
            role: userRole
          });
          return;
        }
      }
    } catch (error) {
      console.error(isSignup ? 'Signup error:' : 'Login error:', error);
      setError(error.message || `An error occurred during ${isSignup ? 'signup' : 'login'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    try {
      setError('');
      setIsLoading(true);
      
      // Use the AuthContext function for social login
      await socialSignIn(provider);
      
      // The redirect will happen automatically
      // The authentication state will be handled by the AuthContext's onAuthStateChange listener
    } catch (error) {
      console.error(`${provider} login error:`, error);
      setError(error.message || `An error occurred during ${provider} login`);
      setIsLoading(false);
    }
  };

  // Check for authentication on mount and after OAuth redirects
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // User is authenticated after social login
        const { user } = session;
        
        // Notify the parent component about successful login
        onLoginSuccess({
          token: session.access_token,
          id: user.id,
          email: user.email,
          role: 'user' // Default role, could be fetched from your database
        });
      }
    };
    
    checkSession();
  }, [supabase, onLoginSuccess]);

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="splash-image">
          <img 
            src="https://ailevelup.ai/wp-content/uploads/2025/03/SendMCPPhoneCallSplash.jpeg" 
            alt="Phone Call MCP" 
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/images/placeholder-logo.png';
              console.error('Error loading splash image');
            }}
          />
        </div>
        <h2>Phone Call MCP</h2>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          
          {isSignup && (
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter your full name"
              />
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>
          
          {isSignup && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm your password"
              />
            </div>
          )}
          
          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading}
          >
            {isLoading 
              ? (isSignup ? 'Creating Account...' : 'Signing In...') 
              : (isSignup ? 'Create Account' : 'Sign In')}
          </button>
        </form>
        
        <div className="social-login">
          <p className="divider">or continue with</p>
          <div className="social-buttons">
            <button 
              type="button" 
              className="social-button github"
              onClick={() => handleSocialLogin('github')}
              disabled={isLoading}
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Github
            </button>
            <button 
              type="button" 
              className="social-button google"
              onClick={() => handleSocialLogin('google')}
              disabled={isLoading}
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"/>
              </svg>
              Google
            </button>
          </div>
        </div>
        
        <div className="auth-toggle">
          <p>
            {isSignup 
              ? 'Already have an account?' 
              : 'Don\'t have an account?'}
            <button 
              type="button" 
              className="toggle-button" 
              onClick={toggleMode}
            >
              {isSignup ? 'Sign In' : 'Create Account'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login; 