import React from 'react';

export default function Spinner() {
  return (
    <div className="flex gap-1 items-center justify-center">
      <div className="w-2 h-2 rounded-full bg-gray-400" style={{ animation: 'bounce-dot 1.2s ease-in-out infinite', animationDelay: '0s' }}></div>
      <div className="w-2 h-2 rounded-full bg-gray-400" style={{ animation: 'bounce-dot 1.2s ease-in-out infinite', animationDelay: '0.2s' }}></div>
      <div className="w-2 h-2 rounded-full bg-gray-400" style={{ animation: 'bounce-dot 1.2s ease-in-out infinite', animationDelay: '0.4s' }}></div>
    </div>
  );
}
