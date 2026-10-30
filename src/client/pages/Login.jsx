import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, ArrowRight, UserCheck, ShieldCheck, AlertCircle } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLoginSubmit = async (targetEmail, targetPass) => {
    setError('');
    setLoading(true);

    const emailToUse = targetEmail || email;
    const passToUse = targetPass || password;

    const result = await login(emailToUse, passToUse);
    setLoading(false);

    if (result.success) {
      // Si entra como celador, redirigir directo al Escáner
      if (result.user?.role?.name === 'celador' || result.user?.role?.name === 'security') {
        navigate('/monitor');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleLoginSubmit();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-primary)',
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow)',
        overflow: 'hidden'
      }}>
        {/* Encabezado */}
        <div style={{
          padding: '34px 32px 22px',
          textAlign: 'center',
          borderBottom: '1px solid var(--border)'
        }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '12px',
            backgroundColor: 'var(--accent-soft)',
            border: '1px solid var(--accent-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'var(--accent)'
          }}>
            <Shield size={28} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            Control de Acceso RFID
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Corporación Universitaria Lasallista — Caldas, Antioquia
          </p>
        </div>

        {/* Formulario */}
        <div style={{ padding: '26px 32px' }}>
          {/* Mensaje Informativo de Roles */}
          <div style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            marginBottom: '20px',
            lineHeight: 1.4,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Lock size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span><b>Acceso restringido:</b> Esta consola es de uso exclusivo para el <b>Administrador</b> y el <b>Celador / Seguridad</b>. Estudiantes y docentes validan mediante carnet en puerta.</span>
          </div>

          {error && (
            <div className="vibrate-error" style={{
              padding: '12px 14px',
              backgroundColor: 'var(--status-denied-bg)',
              border: '1px solid var(--status-denied-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '12.5px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} style={{ color: 'var(--accent)' }} />
              <span>{error}</span>
            </div>
          )}

          {/* Accesos Directos 1-Clic para Administrador y Celador */}
          <div style={{ marginBottom: '22px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
              Seleccione su rol de ingreso:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleLoginSubmit('celador@lasallista.edu.co', 'acceso2026')}
                className="btn btn-secondary"
                style={{ padding: '12px 10px', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}
                disabled={loading}
              >
                <ShieldCheck size={20} style={{ color: 'var(--accent)' }} />
                <span style={{ fontWeight: 700, fontSize: '13px' }}>Celador / Guardia</span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Escáner en Portería</span>
              </button>

              <button
                type="button"
                onClick={() => handleLoginSubmit('admin@lasallista.edu.co', 'acceso2026')}
                className="btn btn-secondary"
                style={{ padding: '12px 10px', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}
                disabled={loading}
              >
                <UserCheck size={20} style={{ color: 'var(--accent)' }} />
                <span style={{ fontWeight: 700, fontSize: '13px' }}>Administrador</span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Control Total</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '10px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>O con credenciales</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Usuario o Correo</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '36px' }}
                  placeholder="admin o celador@lasallista.edu.co"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '22px' }}>
              <label className="form-label">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '36px' }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '14px', letterSpacing: '0.3px' }}
              disabled={loading}
            >
              <span>{loading ? 'Validando Acceso...' : 'Iniciar Sesión'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          backgroundColor: 'var(--bg-tertiary)',
          borderTop: '1px solid var(--border)',
          textAlign: 'center',
          fontSize: '11.5px',
          color: 'var(--text-muted)'
        }}>
          Control de Acceso Institucional y Validación Visual · 2026-2
        </div>
      </div>
    </div>
  );
};
