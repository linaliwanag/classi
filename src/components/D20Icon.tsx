import React from 'react';

const D20Icon: React.FC = () => {
  return (
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      className="inline-block ml-1"
      style={{ transform: 'translateY(-2px)' }}
    >
      <polygon 
        points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" 
        fill="#d4c4a8" 
        stroke="#8b4513" 
        strokeWidth="1"
      />
      <circle cx="12" cy="12" r="1.5" fill="#8b4513" />
      <circle cx="8" cy="8" r="1" fill="#8b4513" />
      <circle cx="16" cy="8" r="1" fill="#8b4513" />
      <circle cx="8" cy="16" r="1" fill="#8b4513" />
      <circle cx="16" cy="16" r="1" fill="#8b4513" />
    </svg>
  );
};

export default D20Icon; 