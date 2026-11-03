import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout/Layout';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Monitor } from './pages/Monitor';
import { InstitutionalMap } from './pages/InstitutionalMap';
import { Users } from './pages/Users';
import { RFIDCards } from './pages/RFIDCards';
import { Schedules } from './pages/Schedules';
import { AccessLogs } from './pages/AccessLogs';
import { Alerts } from './pages/Alerts';
import { NotFound } from './pages/NotFound';
import { Analytics } from '@vercel/analytics/react';

import './App.css';

const HomeRedirect = () => {
  const { isCelador } = useAuth();
  return <Navigate to={isCelador ? '/monitor' : '/dashboard'} replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >

            <Route path="/" element={<HomeRedirect />} />

            <Route path="/monitor" element={<Monitor />} />
            <Route path="/logs" element={<AccessLogs />} />
            <Route path="/rfid-cards" element={<RFIDCards />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/map"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <InstitutionalMap />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="/schedules"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Schedules />
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerts"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Alerts />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Analytics />
    </AuthProvider>
  );
}
