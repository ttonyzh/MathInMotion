"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import FileUpload from "./components/features/FileUpload";

// Import the LoadingSpinner with client-side only rendering to prevent hydration errors
const LoadingSpinner = dynamic(() => import('./components/ui/LoadingSpinner'), {
  ssr: false,
});

// Define types for better type safety
interface SolutionData {
  solution: string;
  manimCode: string;
}

export default function Home() {
  // UI state
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRenderingAnimation, setIsRenderingAnimation] = useState(false);
  
  // File and solution state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [solution, setSolution] = useState<string | null>(null);
  const [manimCode, setManimCode] = useState<string | null>(null);
  const [animationUrl, setAnimationUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  
  // Ensure the component is only fully rendered on the client to prevent hydration errors
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Handle file uploads
  const handleFileUpload = (file: File) => {
    setUploadedFile(file);
    setSolution(null);
    setManimCode(null);
    setAnimationUrl(null);
    setRenderError(null);
    console.log('File uploaded:', file.name);
  };
  
  // Handle rendering Manim animation
  const handleRenderAnimation = async () => {
    if (!manimCode) return;
    
    setIsRenderingAnimation(true);
    setRenderError(null);
    setAnimationUrl(null);
    
    try {
      console.log('Sending Manim code for rendering...');
      const response = await fetch('/api/render-manim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manimCode }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to render animation (${response.status})`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        if (data.videoBase64) {
          setAnimationUrl(`data:video/mp4;base64,${data.videoBase64}`);
          console.log('Manim video loaded successfully');
        } else if (data.textFallback) {
          console.log('Received text fallback instead of video');
          setRenderError(data.message || 'Video rendering is not available. Showing code instead.');
        } else {
          throw new Error('No video data received from the server');
        }
      } else {
        throw new Error(data.error || 'Unknown error occurred during rendering');
      }
    } catch (error) {
      console.error('Error rendering animation:', error);
      setRenderError(error instanceof Error ? error.message : 'Failed to render animation');
    } finally {
      setIsRenderingAnimation(false);
    }
  };

  // Handle showing the solution
  const handleShowSolution = async () => {
    if (!uploadedFile) return;
    
    setIsLoading(true);
    setSolution(null);
    setManimCode(null);
    setAnimationUrl(null);
    setRenderError(null);
    
    try {
      // Create form data to send to API
      const formData = new FormData();
      formData.append('file', uploadedFile);
      
      // Call the API endpoint that integrates with Azure OpenAI
      const response = await fetch('/api/process-problem', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to process the problem');
      }
      
      const data = await response.json();
      
      if (data.success) {
        console.log('Received solution from API');
        console.log('Received Manim code:', data.manimCode ? `${data.manimCode.substring(0, 100)}...` : 'None');
        
        setSolution(data.solution);
        setManimCode(data.manimCode);
        
        if (data.manimCode) {
          console.log('Manim code available, ready for rendering');
        } else {
          console.warn('No Manim code received from API');
        }
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error processing file:', error);
      setSolution('Error: Failed to process your problem. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Only render the full UI when mounted on the client
  // This prevents hydration errors by ensuring the component renders the same content on server and client initially
  if (!isMounted) {
    return <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800"></div>;
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <Header />

      <main className="flex-grow">
        {/* Solution and Animation Section */}
        {(solution || isRenderingAnimation) && (
          <section className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 mb-8 mx-4 sm:mx-10 lg:mx-auto max-w-6xl">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Solution</h2>
            
            {/* Solution Text */}
            {solution && (
              <div className="prose dark:prose-invert max-w-none mb-6">
                <p className="whitespace-pre-wrap">{solution}</p>
              </div>
            )}
            
            {/* Animation Container */}
            <div className="mt-6">
              <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-3">Visual Explanation</h3>
              
              {/* Loading State */}
              {isRenderingAnimation && !animationUrl && (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-300">Rendering animation...</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">This may take a moment</p>
                </div>
              )}
              
              {/* Video Player */}
              {animationUrl && (
                <div className="bg-black rounded-lg overflow-hidden">
                  <video 
                    className="w-full" 
                    controls 
                    autoPlay 
                    loop
                    playsInline
                    onError={(e) => {
                      console.error('Error loading video:', e);
                      setRenderError('Failed to load the animation. Please try again.');
                    }}
                  >
                    <source src={animationUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
              
              {/* Text Fallback Message */}
              {!animationUrl && !isRenderingAnimation && renderError && renderError.includes('Cairo library dependency issues') && (
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-6 whitespace-pre-wrap">
                  <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">Manim Rendering Unavailable</h4>
                  <p className="text-gray-600 dark:text-gray-300">{renderError}</p>
                  <div className="mt-4 p-4 bg-gray-200 dark:bg-gray-600 rounded overflow-auto">
                    <pre className="text-xs text-gray-700 dark:text-gray-300">
                      <code>{manimCode}</code>
                    </pre>
                  </div>
                </div>
              )}
              
              {/* Error Message */}
              {renderError && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-600 dark:text-red-400">{renderError}</p>
                  <button
                    onClick={handleRenderAnimation}
                    className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    disabled={isRenderingAnimation}
                  >
                    {isRenderingAnimation ? 'Rendering...' : 'Try Again'}
                  </button>
                </div>
              )}
              
              {/* Render Button */}
              {!isRenderingAnimation && manimCode && !animationUrl && !renderError && (
                <button
                  onClick={handleRenderAnimation}
                  className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Generate Animation
                </button>
              )}
            </div>
          </section>
        )}

        {/* Hero Section */}
        <section className="py-16 px-6 sm:px-10 max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 dark:text-white leading-tight">
                Visual STEM Learning <span className="text-blue-600 dark:text-blue-400">Powered by AI</span>
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                Upload your STEM problems and get step-by-step visual explanations created with Manim animations. Perfect for students struggling with math, physics, and other STEM subjects.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                  Try It Now
                </button>
                <button className="px-6 py-3 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-medium rounded-lg transition-colors">
                  Learn More
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 relative z-10">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Upload or Type Your Problem</span>
                  </div>
                  <FileUpload onFileUpload={handleFileUpload} />
                </div>
                {uploadedFile ? (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">File Uploaded Successfully</span>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-4 flex items-center">
                      <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded mr-3">
                        {uploadedFile.type.includes('image') ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{uploadedFile.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{(uploadedFile.size / 1024).toFixed(2)} KB</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleShowSolution}
                      disabled={isLoading}
                      className={`w-full py-2 px-4 rounded-lg flex items-center justify-center ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white font-medium transition-colors`}
                    >
                      {isLoading ? <LoadingSpinner /> : 'Show Solution'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-2 mt-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Upload a file to get started</span>
                  </div>
                )}
                
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Visual Explanation</span>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 min-h-32 flex items-start justify-center">
                    {solution ? (
                      <div className="w-full">
                        <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">Solution:</h3>
                        <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-800 p-3 rounded">
                          {solution}
                        </pre>
                        
                        {manimCode && (
                          <div className="mt-6">
                            <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">Manim Code:</h3>
                            <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-800 p-3 rounded overflow-auto max-h-64">
                              {manimCode}
                            </pre>
                            <div className="mt-4">
                              <button 
                                onClick={handleRenderAnimation}
                                disabled={isRenderingAnimation}
                                className={`w-full py-2 px-4 rounded-lg flex items-center justify-center ${isRenderingAnimation ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white font-medium transition-colors`}
                              >
                                {isRenderingAnimation ? <LoadingSpinner text="Rendering Animation..." /> : 'Render Animation'}
                              </button>
                              {renderError && (
                                <p className="mt-2 text-sm text-red-500">{renderError}</p>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="mt-6 text-center">
                          <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">Visual Explanation</h3>
                          {animationUrl ? (
                            <div className="bg-white rounded-lg overflow-hidden shadow-md">
                              {animationUrl.includes('text/html') ? (
                                <iframe 
                                  className="w-full h-96 border-0" 
                                  srcDoc={typeof window !== 'undefined' ? window.atob(animationUrl.split(',')[1]) : ''}
                                  title="Visual explanation of the solution"
                                  sandbox="allow-scripts allow-same-origin"
                                />
                              ) : animationUrl.includes('image') ? (
                                <img 
                                  className="w-full" 
                                  src={animationUrl}
                                  alt="Visual explanation of the solution"
                                />
                              ) : (
                                <video 
                                  className="w-full" 
                                  controls 
                                  autoPlay 
                                  loop
                                  src={animationUrl}
                                >
                                  Your browser does not support the video tag.
                                </video>
                              )}
                            </div>
                          ) : (
                            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg aspect-video flex items-center justify-center">
                              <p className="text-gray-500 dark:text-gray-400 text-sm">
                                {manimCode ? 'Click "Render Animation" to visualize the solution' : 'Visualization will appear here'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        {uploadedFile ? "Click 'Show Solution' to generate a visual explanation" : "Your animated solution will appear here"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 w-64 h-64 bg-blue-100 dark:bg-blue-900/30 rounded-full filter blur-3xl opacity-70 z-0"></div>
              <div className="absolute -top-6 -left-6 w-48 h-48 bg-purple-100 dark:bg-purple-900/30 rounded-full filter blur-3xl opacity-70 z-0"></div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 px-6 sm:px-10 bg-gray-50 dark:bg-gray-800/50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">How Tutor AI Works</h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Our AI-powered platform transforms complex STEM problems into clear, visual explanations
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Upload Your Problem</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Take a photo, upload a PDF, or type your STEM problem directly into our system.
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">AI Analysis</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Our AI reads and understands your problem using advanced OCR and natural language processing.
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Visual Explanation</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Receive a step-by-step visual explanation created with Manim animations that break down the solution.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
