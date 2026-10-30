import React from 'react';

/**
 * Logotipo Vectorial Oficial RADAR (Paleta de Azules)
 * Red de Acceso y Detección mediante Autenticación RFID
 */
export const RadarLogo = ({ size = 28, animated = false, className = '' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      className={className}
      style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle' }}
    >
      <defs>
        {/* Fondo Radial Azul Profundo */}
        <radialGradient id={`radarBg_${size}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="60%" stopColor="#0b1329" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>

        {/* Barrido de Radar Azul Eléctrico y Cian */}
        <linearGradient id={`radarSweep_${size}`} x1="50%" y1="50%" x2="90%" y2="10%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#0284c7" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
        </linearGradient>

        {/* Resplandor Neón */}
        <filter id={`radarGlow_${size}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Anillo Exterior / Bisel */}
      <circle cx="50" cy="50" r="47" stroke="#1d4ed8" strokeWidth="2.4" fill={`url(#radarBg_${size})`} />
      <circle cx="50" cy="50" r="44" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="2 3" />

      {/* Marcadores Cardinales */}
      <line x1="50" y1="3" x2="50" y2="8" stroke="#38bdf8" strokeWidth="1.8" />
      <line x1="50" y1="92" x2="50" y2="97" stroke="#38bdf8" strokeWidth="1.8" />
      <line x1="3" y1="50" x2="8" y2="50" stroke="#38bdf8" strokeWidth="1.8" />
      <line x1="92" y1="50" x2="97" y2="50" stroke="#38bdf8" strokeWidth="1.8" />

      {/* Anillos Concéntricos de Distancia */}
      <circle cx="50" cy="50" r="35" stroke="#2563eb" strokeWidth="1.3" strokeOpacity="0.55" />
      <circle cx="50" cy="50" r="23" stroke="#38bdf8" strokeWidth="1.2" strokeOpacity="0.65" />
      <circle cx="50" cy="50" r="11" stroke="#60a5fa" strokeWidth="1.1" strokeOpacity="0.75" />

      {/* Ejes / Retículas de Detección */}
      <line x1="50" y1="7" x2="50" y2="93" stroke="#1d4ed8" strokeWidth="1" strokeOpacity="0.6" strokeDasharray="3 3" />
      <line x1="7" y1="50" x2="93" y2="50" stroke="#1d4ed8" strokeWidth="1" strokeOpacity="0.6" strokeDasharray="3 3" />

      {/* Líneas Diagonales de Calibración */}
      <line x1="19" y1="19" x2="81" y2="81" stroke="#1e3a8a" strokeWidth="0.8" strokeOpacity="0.45" />
      <line x1="19" y1="81" x2="81" y2="19" stroke="#1e3a8a" strokeWidth="0.8" strokeOpacity="0.45" />

      {/* Sector de Barrido (Animado o Fijo) */}
      <g style={animated ? { transformOrigin: '50px 50px', animation: 'spin 4s linear infinite' } : undefined}>
        <path d="M 50 50 L 83 17 A 47 47 0 0 0 50 3 Z" fill={`url(#radarSweep_${size})`} />
        <line x1="50" y1="50" x2="83" y2="17" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" filter={`url(#radarGlow_${size})`} />
      </g>

      {/* Ondas de Radiofrecuencia RFID Detectadas */}
      <path d="M 68 26 A 11 11 0 0 1 76 34" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.9" filter={`url(#radarGlow_${size})`} />
      <path d="M 72 22 A 17 17 0 0 1 82 32" stroke="#0ea5e9" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.65" />

      {/* Señal / Blip RFID en Pantalla */}
      <circle cx="67" cy="31" r="3.2" fill="#38bdf8" filter={`url(#radarGlow_${size})`} />
      <circle cx="67" cy="31" r="1.5" fill="#ffffff" />

      {/* Centro / Núcleo del Radar */}
      <circle cx="50" cy="50" r="3.8" fill="#2563eb" />
      <circle cx="50" cy="50" r="1.8" fill="#e0f2fe" filter={`url(#radarGlow_${size})`} />
    </svg>
  );
};
