import React from 'react';

const LogoIcon: React.FC<{ className?: string }> = ({ className = 'w-48 h-auto' }) => (
  <svg
    viewBox="0 0 200 60"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="FarSpace Logo"
  >
    <defs>
      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#9B4DFF' }} />
        <stop offset="100%" style={{ stopColor: '#66E3FF' }} />
      </linearGradient>
      <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    
    {/* Microphone Icon */}
    <g transform="translate(15, 30)">
        <path d="M-5 0 a5 5 0 0 1 10 0v10a5 5 0 0 1 -10 0z" fill="none" stroke="#9B4DFF" strokeWidth="2" filter="url(#neon-glow)" />
        <path d="M-10 10v2a10 10 0 0 0 20 0v-2" fill="none" stroke="#66E3FF" strokeWidth="2" />
        <line x1="0" y1="20" x2="0" y2="25" stroke="#9B4DFF" strokeWidth="2" />
    </g>

    {/* FarSpace Text */}
    <text
      x="45"
      y="38"
      fontFamily="Inter, sans-serif"
      fontSize="24"
      fontWeight="600"
      fill="url(#logoGradient)"
    >
      FarSpace
    </text>
  </svg>
);

export default LogoIcon;
