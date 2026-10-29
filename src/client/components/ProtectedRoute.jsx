import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, requiredRole, requiredPermission }) => {
  const { isAuthenticated, loading, roleName } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#121214',
        color: '#a0a0a8',
        fontSize: '14px',
        fontFamily: 'var(--font-mono)'
      }}>
        <span>Cargando sistema de control de acceso...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && roleName !== requiredRole && roleName !== 'rector') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
