import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { GlobalAccessModal } from '../GlobalAccessModal';

export const Layout = () => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('rfid_sidebar_collapsed') === 'true';
  });

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
      <div className="main-content" style={{ minWidth: 0 }}>
        <Topbar isCollapsed={isCollapsed} onToggleSidebar={handleToggle} />
        <main className="page-container">
          <Outlet />
        </main>
      </div>

      {/* Pop-up Global de Escaneo y Validación RFID para toda la pantalla */}
      <GlobalAccessModal />
    </div>
  );
};
