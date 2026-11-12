import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { GlobalAccessModal } from '../GlobalAccessModal';

const NARROW_BREAKPOINT = 1024;

export const Layout = () => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < NARROW_BREAKPOINT) {
      return true;
    }
    return localStorage.getItem('rfid_sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < NARROW_BREAKPOINT) {
        setIsCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToggle = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('rfid_sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <div className={`app-layout ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar isCollapsed={isCollapsed} onToggle={handleToggle} />
      {!isCollapsed && (
        <div
          className="sidebar-backdrop"
          onClick={handleToggle}
          aria-hidden="true"
        />
      )}
      <div className="main-content" style={{ minWidth: 0 }}>
        <Topbar isCollapsed={isCollapsed} onToggleSidebar={handleToggle} />
        <main className="page-container">
          <Outlet />
        </main>
      </div>

      <GlobalAccessModal />
    </div>
  );
};
