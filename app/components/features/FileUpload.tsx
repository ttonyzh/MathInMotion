"use client";

import React, { useState, useRef } from 'react';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  acceptedFileTypes?: string;
}

export default function FileUpload({ onFileUpload, acceptedFileTypes = ".pdf,.jpg,.jpeg,.png" }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div 
      className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
        isDragging 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-10 w-10 text-gray-400 dark:text-gray-500 mb-2" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
        />
      </svg>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Drag & drop files here, or click to browse
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Supports PDF, JPG, PNG
      </p>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={acceptedFileTypes}
        onChange={handleFileInputChange}
      />
    </div>
  );
}
