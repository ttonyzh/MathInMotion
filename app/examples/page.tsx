"use client";

import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import Link from "next/link";
import { useState } from "react";

const examples = [
  {
    subject: "Algebra",
    color: "blue",
    problems: [
      { label: "Solve for x", text: "Solve for x: 2x + 5 = 13" },
      { label: "Quadratic", text: "Solve x² - 5x + 6 = 0" },
      { label: "Systems", text: "Solve the system: 3x + 2y = 12 and x - y = 1" },
    ],
  },
  {
    subject: "Calculus",
    color: "purple",
    problems: [
      { label: "Derivative", text: "Find the derivative of f(x) = 3x³ - 2x² + x - 7" },
      { label: "Integral", text: "Evaluate the integral of 4x³ + 2x dx" },
      { label: "Limit", text: "Find the limit as x approaches 2 of (x² - 4) / (x - 2)" },
    ],
  },
  {
    subject: "Geometry",
    color: "green",
    problems: [
      { label: "Pythagorean theorem", text: "A right triangle has legs of length 3 and 4. Find the hypotenuse." },
      { label: "Circle area", text: "Find the area of a circle with radius 7 cm." },
      { label: "Triangle angles", text: "A triangle has angles 45° and 60°. Find the third angle." },
    ],
  },
  {
    subject: "Trigonometry",
    color: "pink",
    problems: [
      { label: "Sine rule", text: "Find sin(30°) and explain which side of a right triangle it describes." },
      { label: "SOH-CAH-TOA", text: "In a right triangle, opposite = 5 and hypotenuse = 13. Find the angle θ." },
      { label: "Unit circle", text: "Find the exact value of cos(π/4)." },
    ],
  },
  {
    subject: "Statistics",
    color: "cyan",
    problems: [
      { label: "Mean", text: "Find the mean of: 4, 8, 15, 16, 23, 42" },
      { label: "Standard deviation", text: "Calculate the standard deviation of: 2, 4, 4, 4, 5, 5, 7, 9" },
      { label: "Probability", text: "A bag has 3 red and 5 blue marbles. What is the probability of picking red?" },
    ],
  },
];

const colorMap: Record<string, { badge: string; dot: string; hover: string }> = {
  blue:   { badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",        dot: "bg-blue-500",   hover: "hover:border-blue-400 dark:hover:border-blue-600" },
  purple: { badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20", dot: "bg-purple-500", hover: "hover:border-purple-400 dark:hover:border-purple-600" },
  green:  { badge: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",     dot: "bg-green-500",  hover: "hover:border-green-400 dark:hover:border-green-600" },
  pink:   { badge: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",         dot: "bg-pink-500",   hover: "hover:border-pink-400 dark:hover:border-pink-600" },
  cyan:   { badge: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",         dot: "bg-cyan-500",   hover: "hover:border-cyan-400 dark:hover:border-cyan-600" },
};

export default function ExamplesPage() {
  // key = `${subjectIdx}-${problemIdx}`, value = video data url or "__error__"
  const [videos, setVideos] = useState<Record<string, string>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [modalVideo, setModalVideo] = useState<string | null>(null);

  const handleSolve = async (text: string, key: string) => {
    if (loadingKey !== null) return;
    setLoadingKey(key);
    setVideos(prev => { const n = { ...prev }; delete n[key]; return n; });

    try {
      const formData = new FormData();
      formData.append("problemText", text);
      const processRes = await fetch("/api/process-problem", { method: "POST", body: formData });
      const processData = await processRes.json();
      if (!processData.success || !processData.manimCode) throw new Error("Failed to generate code");

      const renderRes = await fetch("/api/render-manim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manimCode: processData.manimCode }),
      });
      const renderData = await renderRes.json();
      if (!renderData.success || !renderData.videoBase64) throw new Error("Failed to render");

      setVideos(prev => ({ ...prev, [key]: `data:video/mp4;base64,${renderData.videoBase64}` }));
    } catch {
      setVideos(prev => ({ ...prev, [key]: "__error__" }));
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <Header />

      <main className="flex-grow px-4 py-16 flex flex-col items-center gap-14">

        {/* Page header */}
        <div className="text-center max-w-2xl">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-blue-500 dark:text-blue-400 mb-3 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
            Example problems
          </span>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">See what MathInMotion can solve</h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed">
            Click any problem to watch it get solved step by step — or use them as inspiration for your own.
          </p>
        </div>

        {/* Subject sections */}
        <div className="w-full max-w-5xl flex flex-col gap-10">
          {examples.map(({ subject, color, problems }, si) => {
            const c = colorMap[color];
            return (
              <div key={subject}>
                <div className="flex items-center gap-3 mb-4">
                  <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{subject}</h2>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  {problems.map(({ label, text }, pi) => {
                    const key = `${si}-${pi}`;
                    const isLoading = loadingKey === key;
                    const video = videos[key];
                    const hasVideo = video && video !== "__error__";
                    const hasError = video === "__error__";

                    return (
                      <div
                        key={text}
                        className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 ${c.hover} rounded-xl p-5 flex flex-col gap-3 transition-all`}
                      >
                        <span className={`self-start text-xs font-semibold px-2 py-0.5 rounded-full border ${c.badge}`}>
                          {label}
                        </span>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed flex-1">{text}</p>

                        {/* Button */}
                        {hasVideo ? (
                          <button
                            onClick={() => setModalVideo(video)}
                            className="w-full py-2 rounded-lg text-sm font-medium transition-all bg-green-600 hover:bg-green-500 text-white flex items-center justify-center gap-1.5"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            See Video
                          </button>
                        ) : hasError ? (
                          <button
                            onClick={() => handleSolve(text, key)}
                            disabled={loadingKey !== null}
                            className="w-full py-2 rounded-lg text-sm font-medium transition-all bg-red-900/40 hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400 hover:text-gray-500 dark:hover:text-gray-400 border border-red-800/50 hover:border-gray-200 dark:hover:border-gray-700 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Retry
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSolve(text, key)}
                            disabled={loadingKey !== null}
                            className="w-full py-2 rounded-lg text-sm font-medium transition-all bg-gray-100 dark:bg-gray-800 hover:bg-blue-600 text-gray-600 dark:text-gray-400 hover:text-white border border-gray-200 dark:border-gray-700 hover:border-blue-500 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isLoading ? (
                              <>
                                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Video Walkthrough
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center flex flex-col items-center gap-3">
          <p className="text-gray-500 dark:text-gray-400">Have your own problem?</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
          >
            Go to the solver
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>

      </main>

      <Footer />

      {/* Video modal */}
      {modalVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setModalVideo(null)}
        >
          <div
            className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Step-by-step Solution</p>
              <button
                onClick={() => setModalVideo(null)}
                className="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-black">
              <video className="w-full max-h-[75vh]" controls autoPlay loop playsInline>
                <source src={modalVideo} type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
