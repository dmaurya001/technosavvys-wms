import React from 'react';

export default function Globe() {
  return (
    <svg className="globe" viewBox="0 0 520 380" aria-hidden="true">
      <defs>
        <radialGradient id="sph" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#f5c542" />
          <stop offset="45%" stopColor="#1f9d7a" />
          <stop offset="100%" stopColor="#04201c" />
        </radialGradient>
        <linearGradient id="ring" x1="0" x2="1">
          <stop offset="0%" stopColor="#2ee6a6" />
          <stop offset="100%" stopColor="#f5c542" />
        </linearGradient>
      </defs>
      <ellipse
        cx="260"
        cy="200"
        rx="230"
        ry="60"
        fill="none"
        stroke="url(#ring)"
        strokeWidth="5"
        opacity=".8"
        transform="rotate(-12 260 200)"
      />
      <ellipse
        cx="260"
        cy="200"
        rx="230"
        ry="60"
        fill="none"
        stroke="#f5c542"
        strokeWidth="2"
        opacity=".6"
        transform="rotate(10 260 200)"
      />
      <circle cx="260" cy="190" r="140" fill="url(#sph)" />
      <ellipse cx="260" cy="330" rx="160" ry="14" fill="#f5c542" opacity=".3" />
    </svg>
  );
}

