"use client";

import React from 'react';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="w-full py-4 px-6 sm:px-10 flex justify-between items-center border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div className="bg-blue-600 text-white p-2 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Tutor AI</h1>
      </div>
      <nav className="hidden md:flex gap-6">
        <Link href="/" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">Home</Link>
        <Link href="/how-it-works" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">How It Works</Link>
        <Link href="/examples" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">Examples</Link>
        <Link href="/about" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">About</Link>
      </nav>
      <button className="md:hidden text-gray-600 dark:text-gray-300">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </header>
  );
}
