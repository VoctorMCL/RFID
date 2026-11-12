import React, { useId } from 'react';

/**
 * Marca RADAR: un lente de radar limpio con anillos concéntricos, un haz de
 * barrido y ecos detectados. Se evita mezclar ondas tipo Wi-Fi para que el
 * símbolo se lea inequívocamente como un radar.
 */
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
      role="img"
      aria-label="RADAR"
      className={className}
      style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', ...style }}
    >
      <defs>
        <linearGradient id={`ring_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="55%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>

        <linearGradient id={`sweep_${uid}`} x1="50%" y1="50%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
          <stop offset="55%" stopColor="#38bdf8" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.5" />
        </linearGradient>

        <radialGradient id={`glow_${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Lente de radar */}
      <circle cx="50" cy="50" r="46" fill="#040816" stroke={`url(#ring_${uid})`} strokeWidth="2.2" />

      {/* Anillos concéntricos y ejes de referencia */}
      <circle cx="50" cy="50" r="33" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.12" />
      <circle cx="50" cy="50" r="20" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.16" />
      <path d="M50 6v8M50 86v8M6 50h8M86 50h8" stroke="#7dd3fc" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.35" />

      {/* Haz de barrido */}
      <g style={animated ? { transformOrigin: '50px 50px', animation: 'spin 6s linear infinite' } : undefined}>
        <path d="M 50 50 L 50 4 A 46 46 0 0 1 80 19.2 Z" fill={`url(#sweep_${uid})`} />
        <line x1="50" y1="50" x2="50" y2="4" stroke="#7dd3fc" strokeWidth="1.8" strokeLinecap="round" />
      </g>

      {/* Ecos detectados */}
      <circle cx="68.5" cy="32.5" r="4.6" fill={`url(#glow_${uid})`} />
      <circle cx="68.5" cy="32.5" r="2.4" fill="#7dd3fc" />
      <circle cx="39" cy="61" r="1.8" fill="#38bdf8" fillOpacity="0.75" />

      {/* Origen del radar */}
      <circle cx="50" cy="50" r="7.5" fill={`url(#glow_${uid})`} />
      <circle cx="50" cy="50" r="3.2" fill="#38bdf8" />
      <circle cx="50" cy="50" r="1.4" fill="#ffffff" />
    </svg>
  );
};
