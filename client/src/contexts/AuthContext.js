import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { useSupabase } from './SupabaseContext';

// Create context
const AuthContext = createContext();

// Context provider component
export const AuthProvider = ({ children }) => {
  const { supabase } = useSupabase();
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [credits, setCredits] = useState(0);
  const [apiKey, setApiKey] = useState(null);

  // Check for session on mount
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user || null);
      
      if (session?.user) {
        fetchUserDetails(session.user.id);
      }
      
      setLoading(false);
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user || null);
        setLoading(false);
        
        if (session?.user) {
          fetchUserDetails(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Fetch user details (credits, API key, etc.)
  const fetchUserDetails = async (userId) => {
    try {
      // Fetch user API key
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('api_key')
        .eq('id', userId)
        .single();
      
      if (userError) throw userError;
      
      // Fetch user credits
      const { data: creditData, error: creditError } = await supabase
        .from('credits')
        .select('balance')
        .eq('user_id', userId)
        .single();
      
      if (creditError) throw creditError;
      
      setApiKey(userData.api_key);
      setCredits(creditData.balance);
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  // Sign up function
  const signUp = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post('/api/v1/auth/register', {
        email,
        password
      });
      
      if (response.status === 201) {
        // Login after successful registration
        await signIn(email, password);
        return true;
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error signing up');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Sign in function
  const signIn = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post('/api/v1/auth/login', {
        email,
        password
      });
      
      if (response.status === 200 && response.data.token) {
        // Store token and user info
        localStorage.setItem('auth_token', response.data.token);
        
        // Get user data from supabase
        const { data: { user }, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (error) throw error;
        
        setUser(user);
        fetchUserDetails(user.id);
        return true;
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error signing in');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      setLoading(true);
      
      await axios.post('/api/v1/auth/logout');
      await supabase.auth.signOut();
      
      localStorage.removeItem('auth_token');
      setUser(null);
      setSession(null);
      setApiKey(null);
      setCredits(0);
      
      return true;
    } catch (error) {
      setError('Error signing out');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Add credits function
  const addCredits = async (amount) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post('/api/v1/credits/add', {
        amount
      }, {
        headers: {
          'X-API-Key': apiKey
        }
      });
      
      if (response.status === 200) {
        setCredits(prev => prev + amount);
        return true;
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error adding credits');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Reset API key function
  const resetApiKey = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post('/api/v1/auth/reset-api-key', {}, {
        headers: {
          'X-API-Key': apiKey
        }
      });
      
      if (response.status === 200) {
        setApiKey(response.data.api_key);
        return true;
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error resetting API key');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Value to provide in context
  const value = {
    user,
    session,
    loading,
    error,
    credits,
    apiKey,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
    addCredits,
    resetApiKey,
    refreshUserDetails: () => user && fetchUserDetails(user.id)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 