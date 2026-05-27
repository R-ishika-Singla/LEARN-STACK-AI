import React from 'react';
import { GitBranch, Code2, Terminal } from 'lucide-react';
import '../styles/AnimatedGlobe.css';

export default function AnimatedGlobe() {
  return (
    <div className="animated-globe-container">
      {/* 3D Space */}
      <div className="globe-space">

        {/* Developer Image with Transparent Background */}
        <div className="sphere-wrapper developer-image">
          <img
            src="/images.png"
            alt="Developer at laptop"
            className="developer-img"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 30px rgba(52, 211, 153, 0.3))'
            }}
          />
        </div>

        {/* Wavy HTTP Ribbon Below Globe */}
        <div className="ribbon-container ribbon-below">
          <svg className="ribbon" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="ribbonGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>

            {/* Wavy ribbon path */}
            <path
              d="M 0 100 Q 50 70 100 100 T 200 100 T 300 100 T 400 100"
              fill="none"
              stroke="url(#ribbonGradient)"
              strokeWidth="20"
              opacity="0.75"
              strokeLinecap="round"
            />

            {/* HTTP text along wavy path */}
            <text fontSize="16" fontWeight="bold" fill="#ffffff" letterSpacing="2" opacity="0.85">
              <textPath href="#wavyPath" startOffset="50%" textAnchor="middle">
                • HTTP • HTTP • HTTP • HTTP • HTTP •
              </textPath>
            </text>

            <defs>
              <path id="wavyPath" d="M 0 100 Q 50 70 100 100 T 200 100 T 300 100 T 400 100" fill="none" />
            </defs>
          </svg>
        </div>

        {/* Floating Icons */}

        {/* GitHub Icon */}
        <div className="floating-icon github-icon">
          <div className="icon-wrapper">
            <GitBranch size={40} className="icon" />
          </div>
        </div>

        {/* Code Icon */}
        <div className="floating-icon code-icon">
          <div className="icon-wrapper">
            <Code2 size={40} className="icon" />
          </div>
        </div>

        {/* Terminal Icon */}
        <div className="floating-icon terminal-icon">
          <div className="icon-wrapper">
            <Terminal size={40} className="icon" />
          </div>
        </div>

        {/* Extra floating elements */}
        <div className="floating-icon bracket-icon">
          <div className="icon-wrapper bracket">
            {'{ }'}
          </div>
        </div>

        <div className="floating-icon arrow-icon">
          <div className="icon-wrapper arrow">
            {'> _'}
          </div>
        </div>
      </div>

      {/* Glow effect background */}
      <div className="glow-effect glow-emerald"></div>
      <div className="glow-effect glow-cyan"></div>
    </div>
  );
}
