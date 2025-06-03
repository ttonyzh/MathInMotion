"use client";

import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8 px-6 sm:px-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 text-white p-1.5 rounded-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-800 dark:text-white">Tutor AI © {new Date().getFullYear()}</span>
        </div>
        <div className="flex gap-6 text-sm">
          <Link href="/privacy" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">Privacy Policy</Link>
          <Link href="/terms" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">Terms of Service</Link>
          <Link href="/contact" className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">Contact</Link>
        </div>
      </div>
    </footer>
  );
}
