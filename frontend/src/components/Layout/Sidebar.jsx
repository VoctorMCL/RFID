import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  LayoutDashboard,
  Radio,
  Building2,
  Users,
  CreditCard,
  Calendar,
  History,
  AlertTriangle,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export const Sidebar = ({ isCollapsed, onToggle }) => {
  const { user, logout, isAdmin, isCelador } = useAuth();

  const navItems = [
    {
      to: '/monitor',
      label: 'Escáner y Validación',
      icon: Radio,
      visible: true // Visible para ambos (Celador y Admin)
    },
    {
      to: '/dashboard',
      label: 'Panel Principal',
      icon: LayoutDashboard,
      visible: isAdmin
    },
    {
      to: '/map',
      label: 'Mapa Institucional',
      icon: Building2,
      visible: isAdmin
    },
    {
      to: '/users',
      label: 'Personas y Estudiantes',
      icon: Users,
      visible: isAdmin
    },
    {
      to: '/rfid-cards',
      label: 'Tarjetas RFID',
      icon: CreditCard,
      visible: isAdmin
    },
    {
      to: '/schedules',
      label: 'Articulación Horaria',
      icon: Calendar,
      visible: isAdmin
    },
    {
      to: '/logs',
      label: 'Historial de Accesos',
      icon: History,
      visible: true // Visible para Celador y Admin
    },
    {
      to: '/alerts',
      label: 'Centro de Alarmas',
      icon: AlertTriangle,
      visible: true // Visible para Celador y Admin
    }
  ];

  const getInitials = (firstName, lastName) => {
    return `${(firstName || '?')[0]}${(lastName || '')[0]}`.toUpperCase();
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Encabezado con Botón de Toggle */}
      <div className="sidebar-header" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div className="brand-icon">
            <Shield size={20} />
          </div>
          {!isCollapsed && (
            <div className="brand-text" style={{ minWidth: 0, overflow: 'hidden' }}>
              <div className="brand-title" style={{ fontSize: '14px', fontWeight: 800 }}>Acceso RFID</div>
              <div className="brand-subtitle" style={{ fontSize: '10px' }}>Validación Visual</div>
            </div>
          )}
        </div>

        <button
          onClick={onToggle}
          className="sidebar-collapse-btn"
          title={isCollapsed ? 'Expandir barra lateral' : 'Comprimir barra lateral'}
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginLeft: isCollapsed ? '0' : 'auto',
            marginTop: isCollapsed ? '8px' : '0'
          }}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navegación por Módulos */}
      <nav className="sidebar-nav">
        {navItems
          .filter(item => item.visible)
          .map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                title={isCollapsed ? item.label : undefined}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '12px 0' : '10px 14px'
                }}
              >
                <Icon size={19} style={{ flexShrink: 0 }} />
                {!isCollapsed && (
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          })}
      </nav>

      {/* Pie de Barra Lateral */}
      <div className="sidebar-footer">
        {user && (
          <div
            className="user-badge"
            title={`${user.first_name} ${user.last_name} (${user.role?.display_name || 'Personal'})`}
            style={{
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              padding: isCollapsed ? '8px 0' : '8px 10px'
            }}
          >
            <div className="user-avatar" style={{ flexShrink: 0 }}>
              {getInitials(user.first_name, user.last_name)}
            </div>
            {!isCollapsed && (
              <div className="user-info" style={{ minWidth: 0, overflow: 'hidden' }}>
                <div className="user-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.first_name} {user.last_name}
                </div>
                <div className="user-role-label">{user.role?.display_name || 'Personal'}</div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={logout}
          className="btn btn-secondary btn-sm"
          style={{
            width: '100%',
            justifyContent: 'center',
            padding: isCollapsed ? '8px 0' : '8px 12px'
          }}
          title="Cerrar sesión"
        >
          <LogOut size={15} style={{ flexShrink: 0 }} />
          {!isCollapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
};
