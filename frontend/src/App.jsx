import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Pages
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';

import CodeArena from './pages/Arena/CodeArena';

import CandidateDashboard from './pages/Passport/CandidateDashboard';
import RecruiterDashboard from './pages/Recruiter/RecruiterDashboard';

import LandingPage from './pages/Landing/LandingPage';
import Onboarding from './pages/Passport/Onboarding';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Dynamic Dashboard Router based on Role
const RoleBasedDashboard = () => {
  const user = useAuthStore(state => state.user);

  if (user?.role === 'RECRUITER') {
    return <RecruiterDashboard />;
  }

  return <CandidateDashboard />;
};

function App() {
  // Restore auth state from localStorage on app initialization
  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <RoleBasedDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/onboarding" 
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/arena" 
          element={
            <ProtectedRoute>
              <CodeArena />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
