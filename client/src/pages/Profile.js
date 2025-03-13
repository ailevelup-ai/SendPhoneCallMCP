import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSupabase } from '../contexts/SupabaseContext';

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut, updateUserProfile } = useAuth();
  const { supabase } = useSupabase();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [userCredits, setUserCredits] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    companyName: '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  
  // Fetch user data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        navigate('/login');
        return;
      }
      
      try {
        setIsLoading(true);
        
        // Fetch user profile from Supabase
        const { data, error } = await supabase
          .from('users')
          .select('full_name, company_name, credits, api_key')
          .eq('id', user.id)
          .single();
          
        if (error) throw error;
        
        if (data) {
          setFormData({
            fullName: data.full_name || '',
            email: user.email || '',
            companyName: data.company_name || '',
            currentPassword: '',
            newPassword: '',
            confirmNewPassword: '',
          });
          
          setUserCredits(data.credits || 0);
          setApiKey(data.api_key || '');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Failed to load user profile. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, [user, supabase, navigate]);
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle profile update
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Update user profile in Supabase
      await updateUserProfile({
        fullName: formData.fullName,
        companyName: formData.companyName,
      });
      
      setSuccess('Profile updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle password change
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Validate passwords
      if (formData.newPassword !== formData.confirmNewPassword) {
        throw new Error('New passwords do not match');
      }
      
      if (formData.newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters long');
      }
      
      // Update password in Supabase
      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });
      
      if (error) throw error;
      
      setSuccess('Password updated successfully!');
      
      // Clear password fields
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      }));
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (error) {
      console.error('Error changing password:', error);
      setError(error.message || 'Failed to change password. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle API key reset
  const handleResetApiKey = async () => {
    if (!window.confirm('Are you sure you want to reset your API key? This will invalidate your current key.')) {
      return;
    }
    
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Call API to reset API key
      const response = await fetch('/api/v1/auth/reset-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reset API key');
      }
      
      const data = await response.json();
      
      setApiKey(data.apiKey);
      setShowApiKey(true);
      setSuccess('API key reset successfully!');
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    } catch (error) {
      console.error('Error resetting API key:', error);
      setError(error.message || 'Failed to reset API key. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }
    
    if (!window.prompt('Please type "DELETE" to confirm account deletion:') === 'DELETE') {
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      // Delete user account
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      
      if (error) throw error;
      
      // Sign out user
      await signOut();
      
      // Redirect to home page
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      setError('Failed to delete account. Please contact support for assistance.');
      setIsSaving(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="profile-page loading">
        <div className="loading-spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }
  
  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>Your Profile</h1>
        <p>View and update your account information</p>
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
      
      <div className="profile-content">
        <div className="profile-section">
          <h2>Account Information</h2>
          
          <form onSubmit={handleProfileUpdate} className="profile-form">
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                className="form-control"
                disabled={isSaving}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                className="form-control"
                disabled={true}
              />
              <small className="form-text text-muted">
                Email address cannot be changed
              </small>
            </div>
            
            <div className="form-group">
              <label htmlFor="companyName">Company Name (Optional)</label>
              <input
                type="text"
                id="companyName"
                name="companyName"
                value={formData.companyName}
                onChange={handleInputChange}
                className="form-control"
                disabled={isSaving}
              />
            </div>
            
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
        
        <div className="profile-section">
          <h2>Credits</h2>
          
          <div className="credits-info">
            <div className="current-credits">
              <span>Available Credits:</span>
              <strong>{userCredits}</strong>
            </div>
            
            <button
              onClick={() => navigate('/credits')}
              className="btn btn-outline"
            >
              Add Credits
            </button>
          </div>
        </div>
        
        <div className="profile-section">
          <h2>API Key</h2>
          
          <div className="api-key-container">
            <div className="api-key-display">
              <label>Your API Key:</label>
              <div className="api-key-field">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  readOnly
                  className="form-control"
                />
                <button
                  type="button"
                  className="btn btn-icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKey);
                    setSuccess('API key copied to clipboard!');
                    setTimeout(() => setSuccess(null), 3000);
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
            
            <button
              onClick={handleResetApiKey}
              className="btn btn-warning"
              disabled={isSaving}
            >
              Reset API Key
            </button>
          </div>
          
          <div className="api-key-info">
            <p>
              Your API key is used to authenticate requests to our API.
              Keep it secret and never share it publicly.
            </p>
          </div>
        </div>
        
        <div className="profile-section">
          <h2>Change Password</h2>
          
          <form onSubmit={handlePasswordChange} className="password-form">
            <div className="form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleInputChange}
                className="form-control"
                required
                disabled={isSaving}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                className="form-control"
                required
                disabled={isSaving}
              />
              <small className="form-text text-muted">
                Must be at least 8 characters long
              </small>
            </div>
            
            <div className="form-group">
              <label htmlFor="confirmNewPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmNewPassword"
                name="confirmNewPassword"
                value={formData.confirmNewPassword}
                onChange={handleInputChange}
                className="form-control"
                required
                disabled={isSaving}
              />
            </div>
            
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
            >
              {isSaving ? 'Changing Password...' : 'Change Password'}
            </button>
          </form>
        </div>
        
        <div className="profile-section danger-zone">
          <h2>Danger Zone</h2>
          
          <div className="danger-action">
            <div className="danger-info">
              <h3>Delete Account</h3>
              <p>
                This will permanently delete your account and all associated data.
                This action cannot be undone.
              </p>
            </div>
            
            <button
              onClick={handleDeleteAccount}
              className="btn btn-danger"
              disabled={isSaving}
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile; 