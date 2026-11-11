import React, { useId } from 'react';

export const RadarLogo = ({ size = 28, animated = false, className = '', style = {} }) => {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      className={className}
      style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', ...style }}
    >
      <defs>
        <linearGradient id={`ring_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="60%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>

        <linearGradient id={`wave_${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="45%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>

        <linearGradient id={`sweep_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
        </linearGradient>

        <radialGradient id={`glow_${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Lente circular profundo minimalista */}
      <circle cx="50" cy="50" r="46" fill="#040816" stroke={`url(#ring_${uid})`} strokeWidth="2.2" />

      {/* Guías concéntricas tenues de alta precisión */}
      <circle cx="50" cy="50" r="38" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.1" />
      <circle cx="50" cy="50" r="26" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.1" />
      <circle cx="50" cy="50" r="14" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.12" />

      {/* Haz de barrido rotativo */}
      <g style={animated ? { transformOrigin: '50px 50px', animation: 'spin 5s linear infinite' } : undefined}>
        <path d="M 50 50 L 50 4 A 46 46 0 0 1 82.5 17.5 Z" fill={`url(#sweep_${uid})`} />
        <line x1="50" y1="50" x2="50" y2="4" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" />
      </g>

      {/* Ondas RFID / NFC de acceso con trazo moderno redondeado */}
      <path d="M 50 36 A 14 14 0 0 1 64 50" stroke={`url(#wave_${uid})`} strokeWidth="3.6" strokeLinecap="round" />
      <path d="M 50 24 A 26 26 0 0 1 76 50" stroke={`url(#wave_${uid})`} strokeWidth="3.8" strokeLinecap="round" />
      <path d="M 50 12 A 38 38 0 0 1 88 50" stroke={`url(#wave_${uid})`} strokeWidth="4.2" strokeLinecap="round" />

      {/* Eco sutil para equilibrio y rotación simétrica */}
      <path d="M 50 64 A 14 14 0 0 1 36 50" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.22" />
      <path d="M 50 76 A 26 26 0 0 1 24 50" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.12" />

      {/* Tarjeta / Tag RFID detectada en el campo */}
      <circle cx="68.4" cy="31.6" r="3.2" fill="#38bdf8" />
      <circle cx="68.4" cy="31.6" r="1.4" fill="#ffffff" />

      {/* Baliza del sensor central */}
      <circle cx="50" cy="50" r="8" fill={`url(#glow_${uid})`} />
      <circle cx="50" cy="50" r="3.5" fill="#38bdf8" />
      <circle cx="50" cy="50" r="1.5" fill="#ffffff" />
    </svg>
  );
};
