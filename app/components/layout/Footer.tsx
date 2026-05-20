"use client";

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200/60 dark:border-white/[0.06] bg-white/50 dark:bg-transparent py-8 px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-500">
            MathInMotion &copy; {new Date().getFullYear()}
          </span>
        </div>
        <nav className="flex gap-5 text-sm text-gray-400 dark:text-gray-600">
          <Link href="/how-it-works" className="hover:text-gray-700 dark:hover:text-gray-400 transition-colors">How it works</Link>
          <Link href="/examples" className="hover:text-gray-700 dark:hover:text-gray-400 transition-colors">Examples</Link>
          <Link href="/about" className="hover:text-gray-700 dark:hover:text-gray-400 transition-colors">About</Link>
        </nav>
      </div>
    </footer>
  );
}
