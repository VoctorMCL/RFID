import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
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

import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta pública */}
          <Route path="/login" element={<Login />} />

          {/* Rutas Protegidas del Ecosistema */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/monitor" element={<Monitor />} />
            <Route path="/map" element={<InstitutionalMap />} />
            <Route path="/users" element={<Users />} />
            <Route path="/rfid-cards" element={<RFIDCards />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/logs" element={<AccessLogs />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
