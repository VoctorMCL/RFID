import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, roleName, isAdmin } = useAuth();
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
        <span>Cargando sistema de control de acceso institucional...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const normRole = (roleName || '').toLowerCase();
    const isAllowed = allowedRoles.includes(normRole) || (allowedRoles.includes('admin') && isAdmin);
    if (!isAllowed) {
      // Redirigir según el rol
      const target = (normRole === 'celador' || normRole === 'security') ? '/monitor' : '/dashboard';
      return <Navigate to={target} replace />;
    }
  }

  return children;
};
