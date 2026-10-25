// ===================================================================
// Cliente y Servicio de Conexión a Supabase (PostgreSQL)
// Proyecto: Control de Acceso Peatonal RFID/NFC con Validación Visual
// Corporación Universitaria Lasallista (Caldas - Antioquia)
// ===================================================================

export const SUPABASE_URL = 'https://rebvmpptmwltrovsxqjb.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlYnZtcHB0bXdsdHJvdnN4cWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3Mjg1MjgsImV4cCI6MjEwNDMwNDUyOH0.ZZ54_0qYxxgSiF3GcWaNE2jsljRJWHYdvr4GL7YFEyY';

function sbHeaders(extra = {}) {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    ...extra
  };
}

export async function sbGet(table, query = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*${query}`, {
    headers: sbHeaders()
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error en ${table}: ${res.status} ${errText}`);
  }
  return res.json();
}

export async function sbInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: sbHeaders({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al insertar en ${table}: ${res.status} ${errText}`);
  }
  const result = await res.json();
  return result[0];
}

export async function sbUpdate(table, matchCol, matchVal, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${matchCol}=eq.${encodeURIComponent(matchVal)}`, {
    method: 'PATCH',
    headers: sbHeaders({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(patch)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al actualizar ${table}: ${res.status} ${errText}`);
  }
  return res.json();
}

export async function sbDelete(table, matchCol, matchVal) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${matchCol}=eq.${encodeURIComponent(matchVal)}`, {
    method: 'DELETE',
    headers: sbHeaders()
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al eliminar de ${table}: ${res.status} ${errText}`);
  }
}

// Normalizador de UID
export function normUid(s) {
  return String(s || '').replace(/[\s:\-]/g, '').toUpperCase();
}

// Generador de color consistente a partir de cadena
export function colorFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
}

// Generador de iniciales
export function getInitials(nombre, apellido) {
  const n = (nombre || '').trim().charAt(0);
  const a = (apellido || '').trim().charAt(0);
  return (n + a).toUpperCase() || 'ID';
}

// Retroalimentación de Audio con Web Audio API
export function playAccessSound(isAllowed) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isAllowed) {
      // Tono ascendente agradable de éxito
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else {
      // Tono bajo de rechazo
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.setValueAtTime(110, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    console.warn('Audio no inicializado:', e);
  }
}

// Vibración háptica en dispositivos compatibles
export function triggerHapticFeedback(isError = true) {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    try {
      if (isError) {
        // Patrón de vibración de error: 3 pulsos rápidos
        window.navigator.vibrate([120, 60, 120, 60, 200]);
      } else {
        // Pulso corto de éxito
        window.navigator.vibrate(80);
      }
    } catch (e) {
      // ignorar si no está permitido
    }
  }
}
