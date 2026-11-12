// ============================================================================
// DEMO-ADMIN-LOGIN  ·  BOTÓN TEMPORAL SOLO PARA PRUEBAS
// Inicia sesión como administrador con la tarjeta maestra del seed, usando el
// mismo flujo normal de login por tarjeta (/auth/rfid-login). No toca el servidor.
//
// CÓMO ELIMINARLO (3 pasos, sin efectos secundarios):
//   1. Borrar este archivo:  src/client/components/DemoAdminLogin.jsx
//   2. En src/client/pages/Login.jsx borrar la línea:  import { DemoAdminLogin } ...  (marcada DEMO-ADMIN-LOGIN)
//   3. En src/client/pages/Login.jsx borrar la línea:  <DemoAdminLogin />            (marcada DEMO-ADMIN-LOGIN)
// ============================================================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO_ADMIN_CARD_UID = '9B160795'; // 'Carnet Maestro Administrador' del seed

export const DemoAdminLogin = () => {
  const { loginWithCard } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const enter = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await loginWithCard(DEMO_ADMIN_CARD_UID);
      if (res?.success) navigate('/dashboard', { replace: true });
      else setError(res?.error || 'No se pudo iniciar sesión');
    } catch (e) {
      setError(e.message || 'Error de conexión');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      {error && <div style={{ fontSize: 11, color: '#ef4444', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 6 }}>{error}</div>}
      <button
        type="button"
        onClick={enter}
        disabled={busy}
        className="btn btn-secondary btn-sm"
        style={{ opacity: 0.85, borderStyle: 'dashed' }}
        title="Botón temporal de pruebas"
      >
        {busy ? 'Entrando…' : 'Entrar como admin (prueba)'}
      </button>
    </div>
  );
};
