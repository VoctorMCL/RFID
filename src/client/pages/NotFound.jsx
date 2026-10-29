import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const NotFound = () => {
  return (
    <div style={{
      textAlign: 'center',
      padding: '80px 20px',
      maxWidth: '480px',
      margin: '0 auto'
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        backgroundColor: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px',
        color: 'var(--text-muted)'
      }}>
        <ShieldAlert size={32} />
      </div>
      <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
        404 — Ruta No Encontrada
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', marginBottom: '24px' }}>
        El módulo o recurso del ecosistema al que intenta acceder no existe o fue reubicado.
      </p>
      <Link to="/dashboard" className="btn btn-primary" style={{ display: 'inline-flex' }}>
        <ArrowLeft size={16} />
        <span>Regresar al Panel Principal</span>
      </Link>
    </div>
  );
};
