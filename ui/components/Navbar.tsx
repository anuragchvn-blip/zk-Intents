'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    
    // Check for existing session
    const savedSession = api.loadSession();
    if (savedSession) {
      setSession(savedSession);
    }

    // Listen for storage events to sync session across components
    const handleStorageChange = () => {
      const currentSession = api.loadSession();
      setSession(currentSession);
    };
    window.addEventListener('storage', handleStorageChange);
    // Custom event for same-window updates
    window.addEventListener('session-update', handleStorageChange);

    // Polling fallback to ensure session is synced
    const interval = setInterval(() => {
      const currentSession = api.loadSession();
      // Only update if changed to avoid re-renders
      setSession((prev: any) => {
        if (JSON.stringify(prev) !== JSON.stringify(currentSession)) {
          return currentSession;
        }
        return prev;
      });
    }, 1000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('session-update', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const navLinks = [
    { name: 'Technology', href: '/technology' },
    { name: 'Developers', href: '/developers' },
    { name: 'About', href: '/about' },
  ];

  const handleConnect = () => {
    if (session) return;
    // Scroll to demo section for auth
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-sui-deep/80 backdrop-blur-md border-b border-white/5' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sui-sea rounded-full"></div>
          <span className="font-bold text-xl tracking-tight text-white">zk-Intents</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-sm font-medium text-sui-steel hover:text-white transition-colors"
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/docs" className="text-sm font-medium text-white hover:text-sui-sea transition-colors">
            Documentation
          </Link>
          <button 
            onClick={handleConnect}
            disabled={!!session}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              session 
                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                : 'bg-sui-sea text-white hover:bg-blue-500 disabled:opacity-50'
            }`}
          >
            {session ? session.address.slice(0, 10) + '...' : 'Connect Wallet'}
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden text-white"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-sui-deep/95 backdrop-blur-lg border-t border-white/5 p-6">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-sm font-medium text-sui-steel hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}
            <Link href="/docs" className="text-sm font-medium text-white hover:text-sui-sea transition-colors">
              Documentation
            </Link>
            <button 
              onClick={handleConnect}
              className="px-5 py-2.5 bg-sui-sea text-white rounded-full text-sm font-semibold hover:bg-blue-500 transition-all"
            >
              {session ? session.address.slice(0, 10) + '...' : 'Connect Wallet'}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
