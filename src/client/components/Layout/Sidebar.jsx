import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { RadarLogo } from '../RadarLogo';
import { SimulatedClock } from './SimulatedClock';
import {
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
  ChevronRight,
  Sun,
  Moon,
  Laptop
} from 'lucide-react';

export const Sidebar = ({ isCollapsed, onToggle }) => {
  const { user, logout, isAdmin, isCelador } = useAuth();

  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('rfid_theme_mode') || 'auto');

  useEffect(() => {
    if (themeMode === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (themeMode === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('rfid_theme_mode', themeMode);
  }, [themeMode]);

  const cycleTheme = () => {
    if (themeMode === 'auto') setThemeMode('dark');
    else if (themeMode === 'dark') setThemeMode('light');
    else setThemeMode('auto');
  };

  const themeLabel = themeMode === 'auto' ? 'Auto' : themeMode === 'light' ? 'Claro' : 'Oscuro';
  const themeTitle = `Tema: ${themeMode === 'auto' ? 'Automático (según dispositivo)' : themeMode === 'light' ? 'Modo claro' : 'Modo oscuro'}`;

  const navItems = [
    {
      to: '/monitor',
      label: 'Escáner y Validación',
      icon: Radio,
      visible: true
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
      label: 'Tarjetas RFID y Pases',
      icon: CreditCard,
      visible: true
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
      visible: true
    },
    {
      to: '/alerts',
      label: 'Centro de Alarmas',
      icon: AlertTriangle,
      visible: isAdmin
    }
  ];

  const getInitials = (firstName, lastName) => {
    return `${(firstName || '?')[0]}${(lastName || '')[0]}`.toUpperCase();
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>

      <div className="sidebar-header" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div className="brand-icon" style={{ padding: 0, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RadarLogo size={32} animated />
          </div>
          {!isCollapsed && (
            <div className="brand-text" style={{ minWidth: 0, overflow: 'hidden' }}>
              <div className="brand-title" style={{ fontSize: '15px', fontWeight: 900, letterSpacing: '0.6px', color: '#38bdf8' }}>
                RADAR
              </div>
              <div
                className="brand-subtitle"
                style={{ fontSize: '9.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                title="Sistema de Control de Acceso RFID"
              >
                Control de Acceso RFID
              </div>
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

      <div className="sidebar-footer">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
          <button
            onClick={cycleTheme}
            className="btn btn-secondary btn-sm"
            title={themeTitle}
            aria-label={themeTitle}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              flexShrink: 0,
              padding: '8px 10px'
            }}
          >
            {themeMode === 'auto' && <Laptop size={15} style={{ color: 'var(--accent)' }} />}
            {themeMode === 'light' && <Sun size={15} style={{ color: '#d97706' }} />}
            {themeMode === 'dark' && <Moon size={15} style={{ color: '#38bdf8' }} />}
            {!isCollapsed && <span style={{ textTransform: 'capitalize' }}>{themeLabel}</span>}
          </button>
          <SimulatedClock isCollapsed={isCollapsed} />
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: isCollapsed ? 'column' : 'row',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {user && (
            <div
              className="user-badge"
              title={`${user.first_name} ${user.last_name} (${user.role?.display_name || 'Personal'})`}
              style={{
                flex: 1,
                minWidth: 0,
                width: isCollapsed ? '100%' : undefined,
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
        </div>

        <button
          onClick={() => logout()}
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
