import React, { createContext, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://rfreswizypwaryzyqczr.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmcmVzd2l6eXB3YXJ5enlxY3pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MDYzOTEsImV4cCI6MjA1NzM4MjM5MX0.7JHj1nSPWKNjPsQWGiJJXy7THrXGIunweh2haeY-NYU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create context
const SupabaseContext = createContext();

// Context provider component
export const SupabaseProvider = ({ children }) => {
  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  );
};

// Custom hook to use the supabase context
export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};

export default supabase; 