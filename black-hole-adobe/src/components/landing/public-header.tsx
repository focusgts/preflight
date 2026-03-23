'use client';

import { useState, useEffect } from 'react';

const navLinks = [
  { href: '/score', label: 'Health Score' },
  { href: '/calculator', label: 'ROI Calculator' },
  { href: '/assessment', label: 'Free Assessment' },
  { href: '/login', label: 'Login' },
];

export function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <a href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400">
            <span className="text-sm font-bold text-white">BH</span>
          </div>
          <span className="text-lg font-bold text-white">Black Hole</span>
        </a>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                link.label === 'Free Assessment'
                  ? 'rounded-lg bg-gradient-to-r from-violet-500 to-cyan-400 px-4 py-2 font-medium text-white hover:brightness-110'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:text-white md:hidden"
          aria-label="Menu"
          onClick={() => {
            const nav = document.getElementById('mobile-nav');
            if (nav) nav.classList.toggle('hidden');
          }}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      <nav id="mobile-nav" className="hidden border-t border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur-xl md:hidden">
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="block py-2 text-sm text-slate-400 hover:text-white"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
