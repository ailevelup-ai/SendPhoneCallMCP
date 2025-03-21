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
      async (event, session) => {
        console.log('Auth state changed:', event);
        setSession(session);
        setUser(session?.user || null);
        
        if (session?.user) {
          // If this is a sign-in or token-refreshed event
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            // For social logins, we might need to create a user record in our database
            const { data: existingUser } = await supabase
              .from('users')
              .select('id')
              .eq('id', session.user.id)
              .single();
              
            if (!existingUser) {
              // Create a user record for social login users
              await createUserForSocialLogin(session.user);
            }
          }
          
          fetchUserDetails(session.user.id);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Create a user record for users who sign in with social providers
  const createUserForSocialLogin = async (user) => {
    try {
      // Generate an API key
      const apiKey = crypto.randomUUID ? crypto.randomUUID() : 
        Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Create user record
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          api_key: apiKey,
          role: 'user'
        })
        .select()
        .single();
        
      if (error) throw error;
      
      // Initialize credits
      await supabase
        .from('credits')
        .insert({
          user_id: user.id,
          balance: 10.0 // Give 10 credits to start
        });
        
      console.log('Created user record for social login user:', user.email);
      return data;
    } catch (error) {
      console.error('Error creating user for social login:', error);
      return null;
    }
  };

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

  // Social login function
  const socialSignIn = async (provider) => {
    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin
        }
      });
      
      if (error) throw error;
      
      // The redirect will happen automatically
      return true;
    } catch (error) {
      console.error(`${provider} signin error:`, error);
      setError(`Error signing in with ${provider}`);
      setLoading(false);
      return false;
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
    socialSignIn,
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