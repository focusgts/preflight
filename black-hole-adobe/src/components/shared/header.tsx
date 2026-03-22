'use client';

import { useState } from 'react';
import { Search, Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function Header() {
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 backdrop-blur-sm">
      {/* Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search migrations, assessments..."
          className={cn(
            'w-full rounded-lg border bg-slate-900 py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 transition-all duration-200 focus:outline-none',
            searchFocused
              ? 'border-violet-500/50 ring-1 ring-violet-500/25'
              : 'border-slate-800 hover:border-slate-700'
          )}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-violet-500">
            <span className="absolute inset-0 animate-ping rounded-full bg-violet-400 opacity-75" />
          </span>
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-800" />

        {/* User */}
        <button className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400">
            <User className="h-4 w-4 text-white" />
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium text-white">Admin User</p>
            <p className="text-xs text-slate-400">admin@blackhole.dev</p>
          </div>
        </button>
      </div>
    </header>
  );
}
