import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Register = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    companyName: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Validate form data
  const validateForm = () => {
    // Check if all required fields are filled
    if (!formData.email.trim() || !formData.password || !formData.confirmPassword || !formData.fullName.trim()) {
      setError('All fields marked with * are required');
      return false;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    // Check password length
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    
    // Check if passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    
    // Check terms agreement
    if (!agreeToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy');
      return false;
    }
    
    return true;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    // Validate form
    if (!validateForm()) {
      setIsLoading(false);
      return;
    }
    
    try {
      // Attempt to sign up
      await signUp(
        formData.email,
        formData.password,
        {
          full_name: formData.fullName,
          company_name: formData.companyName || null,
        }
      );
      
      // Show success message
      setSuccess('Registration successful! Please check your email to verify your account.');
      
      // Clear form
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        companyName: '',
      });
      setAgreeToTerms(false);
      
      // Redirect to login page after a delay
      setTimeout(() => {
        navigate('/login');
      }, 5000);
      
    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle different error types
      if (error.message.includes('already registered')) {
        setError('This email is already registered. Please use a different email or try logging in.');
      } else {
        setError(error.message || 'An error occurred during registration. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="auth-page register-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>Create an Account</h1>
          <p>Sign up to start making AI phone calls</p>
        </div>
        
        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}
        
        {success && (
          <div className="alert alert-success">
            {success}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="your@email.com"
              required
              className="form-control"
              disabled={isLoading || success}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="fullName">Full Name *</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              placeholder="John Doe"
              required
              className="form-control"
              disabled={isLoading || success}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="companyName">Company Name (Optional)</label>
            <input
              type="text"
              id="companyName"
              name="companyName"
              value={formData.companyName}
              onChange={handleInputChange}
              placeholder="Acme Inc."
              className="form-control"
              disabled={isLoading || success}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="••••••••"
              required
              className="form-control"
              disabled={isLoading || success}
            />
            <small className="form-text text-muted">
              Must be at least 8 characters long
            </small>
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="••••••••"
              required
              className="form-control"
              disabled={isLoading || success}
            />
          </div>
          
          <div className="form-group terms-checkbox">
            <input
              type="checkbox"
              id="agreeToTerms"
              checked={agreeToTerms}
              onChange={(e) => setAgreeToTerms(e.target.checked)}
              className="form-check-input"
              disabled={isLoading || success}
            />
            <label htmlFor="agreeToTerms" className="form-check-label">
              I agree to the{' '}
              <Link to="/terms" target="_blank" rel="noopener noreferrer">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </Link>
            </label>
          </div>
          
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={isLoading || success}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register; 