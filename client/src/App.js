import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SupabaseProvider } from './contexts/SupabaseContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Components
import Header from './components/Header';
import Footer from './components/Footer';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CallHistory from './pages/CallHistory';
import CallDetails from './pages/CallDetails';
import ApiDocs from './pages/ApiDocs';
import Credits from './pages/Credits';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

// CSS
import './App.css';

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <SupabaseProvider>
      <AuthProvider>
        <Router>
          <div className="app">
            <Header />
            <main>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/api-docs" element={<ApiDocs />} />
                
                {/* Protected routes */}
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/call-history" 
                  element={
                    <ProtectedRoute>
                      <CallHistory />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/call/:id" 
                  element={
                    <ProtectedRoute>
                      <CallDetails />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/credits" 
                  element={
                    <ProtectedRoute>
                      <Credits />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/profile" 
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } 
                />
                
                {/* 404 route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </AuthProvider>
    </SupabaseProvider>
  );
}

export default App; 