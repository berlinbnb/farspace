
import React from 'react';

const SpeakerIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}>
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
      <circle cx="12" cy="14" r="4"></circle>
      <line x1="12" y1="6" x2="12.01" y2="6"></line>
  </svg>
);

export default SpeakerIcon;
