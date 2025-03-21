import React, { useState } from 'react';
import './Login.css';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');

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

        // Call signup API
        const response = await fetch('/api/v1/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password, name }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Signup failed');
        }

        // Auto-login after successful signup
        await loginUser(email, password);
      } else {
        // Handle login
        await loginUser(email, password);
      }
    } catch (error) {
      console.error(isSignup ? 'Signup error:' : 'Login error:', error);
      setError(error.message || `An error occurred during ${isSignup ? 'signup' : 'login'}`);
      setIsLoading(false);
    }
  };

  const loginUser = async (email, password) => {
    try {
      const response = await fetch('/api/v1/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store the token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.id);
      localStorage.setItem('userEmail', data.email);
      localStorage.setItem('userRole', data.role);

      // Notify the parent component about successful login
      onLoginSuccess(data);
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'An error occurred during login');
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="splash-image">
          <img 
            src="https://ailevelup.ai/wp-content/uploads/2025/03/SendMCPPhoneCallSplash.jpeg" 
            alt="Phone Call MCP" 
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
              ? (isSignup ? 'Creating Account...' : 'Logging in...') 
              : (isSignup ? 'Create Account' : 'Login')}
          </button>
        </form>
        
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