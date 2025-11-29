'use client';

import { useState, useEffect } from 'react';

export default function Hero3D() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
      {/* Deep Ocean Background */}
      <div className="absolute inset-0 bg-sui-deep"></div>
      
      {/* Interactive Gradient Orbs */}
      <div 
        className="absolute top-[-10%] left-[-10%] w-[1000px] h-[1000px] bg-sui-sea/10 rounded-full blur-[120px] transition-transform duration-1000 ease-out will-change-transform"
        style={{ transform: `translate(${mousePosition.x * -20}px, ${mousePosition.y * -20}px)` }}
      ></div>
      
      <div 
        className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-sui-aqua/5 rounded-full blur-[100px] transition-transform duration-1000 ease-out will-change-transform"
        style={{ transform: `translate(${mousePosition.x * 20}px, ${mousePosition.y * 20}px)` }}
      ></div>

      <div 
        className="absolute top-[40%] left-[40%] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[80px] animate-pulse"
        style={{ transform: `translate(${mousePosition.x * 40}px, ${mousePosition.y * 40}px)` }}
      ></div>
      
      {/* Noise Texture for Texture/Depth */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")' }}></div>
      
      {/* Subtle Grid */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]"></div>
    </div>
  );
}
