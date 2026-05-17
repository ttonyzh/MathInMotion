"use client";

import { useState, useEffect, useRef } from "react";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";

type Status = "idle" | "processing" | "rendering" | "done" | "error";

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [problemText, setProblemText] = useState("");
  const [animationUrl, setAnimationUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Practice problems
  const [practiceProblems, setPracticeProblems] = useState<string[]>([]);
  const [isLoadingPractice, setIsLoadingPractice] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setIsMounted(true); }, []);

  const resetState = () => {
    setAnimationUrl(null);
    setErrorMsg(null);
    setStatus("idle");
    setPracticeProblems([]);
    setIsLoadingPractice(false);
  };

  const handleFileSelect = (file: File) => {
    setUploadedFile(file);
    resetState();
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  // Accept an optional override so clicking a practice problem can pass text directly
  // without waiting for state to update
  const handleSolve = async (overrideText?: string) => {
    const textToUse = overrideText ?? problemText;
    if (!uploadedFile && !textToUse.trim()) return;

    setStatus("processing");
    setAnimationUrl(null);
    setErrorMsg(null);
    setPracticeProblems([]);
    setIsLoadingPractice(false);

    const capturedProblem = textToUse.trim();

    try {
      // Step 1: Get Manim code from AI
      const formData = new FormData();
      // Only attach the file if we're not overriding with a typed problem
      if (uploadedFile && !overrideText) formData.append("file", uploadedFile);
      if (textToUse.trim()) formData.append("problemText", textToUse.trim());

      const processRes = await fetch("/api/process-problem", {
        method: "POST",
        body: formData,
      });

      const processData = await processRes.json();
      if (!processData.success || !processData.manimCode) {
        throw new Error(processData.error || "Failed to generate animation code. Please try again.");
      }

      // Step 2: Render the animation
      setStatus("rendering");

      const renderRes = await fetch("/api/render-manim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manimCode: processData.manimCode }),
      });

      const renderData = await renderRes.json();
      if (!renderData.success || !renderData.videoBase64) {
        throw new Error(renderData.error || "Failed to render animation.");
      }

      setAnimationUrl(`data:video/mp4;base64,${renderData.videoBase64}`);
      setStatus("done");
      setIsLoadingPractice(true);

      // Step 3: Generate practice problems in background (non-blocking)
      const problemToUse = capturedProblem || "a math problem";
      fetch("/api/generate-practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalProblem: problemToUse }),
      })
        .then((r) => r.json())
        .then((data) => {
          console.log("[practice] response:", data);
          if (data.problems?.length > 0) {
            setPracticeProblems(data.problems);
          } else {
            setPracticeProblems(["__error__"]);
          }
        })
        .catch((err) => {
          console.error("[practice] fetch error:", err);
          setPracticeProblems(["__error__"]);
        })
        .finally(() => setIsLoadingPractice(false));

    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  const handleTryPracticeProblem = (problem: string) => {
    setProblemText(problem);
    setUploadedFile(null);
    handleSolve(problem);
  };

  const canSolve =
    (!!uploadedFile || problemText.trim().length > 0) &&
    status !== "processing" &&
    status !== "rendering";

  if (!isMounted) return <div className="min-h-screen bg-gray-950" />;

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-white">
      <Header />

      <main className="flex-grow flex flex-col items-center px-4 py-12 gap-10">

        {/* Hero */}
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3 tracking-tight">
            Visual STEM Tutor
          </h1>
          <p className="text-gray-400 text-lg">
            Upload a problem or type it below. We&apos;ll generate a step-by-step animated solution.
          </p>
        </div>

        {/* Input Card */}
        <div className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5 shadow-xl">

          {/* File Upload */}
          <div>
            <p className="text-sm font-medium text-gray-400 mb-2">Upload a file (optional)</p>
            <div
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-blue-500 bg-blue-500/10"
                  : uploadedFile
                  ? "border-green-500 bg-green-500/10"
                  : "border-gray-700 hover:border-gray-500"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadedFile ? (
                <div className="flex items-center gap-3">
                  <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-white">{uploadedFile.name}</p>
                    <p className="text-xs text-gray-400">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setUploadedFile(null); resetState(); }}
                    className="ml-2 text-gray-500 hover:text-red-400 transition-colors"
                    title="Remove file"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <svg className="h-8 w-8 text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-400">Drag & drop or <span className="text-blue-400">browse</span></p>
                  <p className="text-xs text-gray-600 mt-1">PDF, JPG, PNG</p>
                </>
              )}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600 uppercase tracking-wider">or type your problem</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* Text Input */}
          <textarea
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none transition-colors"
            rows={4}
            placeholder="e.g. Solve for x: 2x + 5 = 4"
            value={problemText}
            onChange={(e) => { setProblemText(e.target.value); resetState(); }}
          />

          {/* Submit Button */}
          <button
            onClick={() => handleSolve()}
            disabled={!canSolve}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
              canSolve
                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                : "bg-gray-800 text-gray-600 cursor-not-allowed"
            }`}
          >
            Solve &amp; Animate
          </button>
        </div>

        {/* Status / Results */}
        {status !== "idle" && (
          <div className="w-full max-w-3xl flex flex-col gap-6">

            {/* Processing */}
            {status === "processing" && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-300 font-medium">Analyzing problem...</p>
                <p className="text-gray-500 text-sm">The AI is reading your problem and generating the animation code</p>
              </div>
            )}

            {/* Rendering */}
            {status === "rendering" && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-300 font-medium">Rendering animation...</p>
                <p className="text-gray-500 text-sm">Manim is generating your step-by-step video</p>
              </div>
            )}

            {/* Error */}
            {status === "error" && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-300 text-sm">{errorMsg}</p>
                </div>
                <button
                  onClick={() => handleSolve()}
                  className="self-start text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Video */}
            {status === "done" && animationUrl && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Step-by-step Animation</p>
                  <button
                    onClick={() => { setStatus("idle"); setAnimationUrl(null); setUploadedFile(null); setProblemText(""); setPracticeProblems([]); setIsLoadingPractice(false); }}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Solve another problem
                  </button>
                </div>
                <div className="bg-black">
                  <video
                    className="w-full"
                    controls
                    autoPlay
                    loop
                    playsInline
                    onError={() => {
                      setErrorMsg("Failed to play the video. Please try again.");
                      setStatus("error");
                    }}
                  >
                    <source src={animationUrl} type="video/mp4" />
                  </video>
                </div>
              </div>
            )}

            {/* Practice Problems */}
            {status === "done" && (isLoadingPractice || practiceProblems.length > 0) && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Practice Problems</h3>
                  {isLoadingPractice && (
                    <div className="w-3.5 h-3.5 border border-gray-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  {isLoadingPractice && practiceProblems.length === 0
                    ? // Skeleton placeholders
                      [0, 1, 2].map((i) => (
                        <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
                          <div className="h-3 bg-gray-700 rounded mb-2 w-4/5" />
                          <div className="h-3 bg-gray-700 rounded mb-2 w-3/5" />
                          <div className="h-3 bg-gray-700 rounded mb-5 w-2/5" />
                          <div className="h-8 bg-gray-800 rounded-lg w-full" />
                        </div>
                      ))
                    : practiceProblems[0] === "__error__"
                    ? // Error state — stayed visible instead of vanishing
                      <div className="col-span-3 text-sm text-gray-500 py-2">
                        Could not load practice problems. Check the browser console for details.
                      </div>
                    : practiceProblems.map((problem, i) => (
                        <div
                          key={i}
                          className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 flex flex-col gap-4 transition-colors group"
                        >
                          {/* Problem number badge */}
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-semibold mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-sm text-gray-300 leading-relaxed">{problem}</p>
                          </div>

                          <button
                            onClick={() => handleTryPracticeProblem(problem)}
                            className="w-full py-2 rounded-lg text-sm font-medium transition-all
                              bg-gray-800 hover:bg-blue-600 text-gray-400 hover:text-white
                              border border-gray-700 hover:border-blue-500
                              flex items-center justify-center gap-1.5"
                          >
                            Try it
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </button>
                        </div>
                      ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* How It Works */}
        <div className="w-full max-w-3xl mt-4">
          <h2 className="text-center text-xl font-semibold text-gray-400 mb-6">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                step: "1",
                color: "blue",
                title: "Upload or Type",
                desc: "Submit a photo, PDF, or just type your STEM problem.",
              },
              {
                step: "2",
                color: "purple",
                title: "AI Analyzes",
                desc: "The AI reads and understands the problem, then writes animation code.",
              },
              {
                step: "3",
                color: "green",
                title: "Watch the Solution",
                desc: "A step-by-step animated video walks you through the answer.",
              },
            ].map(({ step, color, title, desc }) => (
              <div key={step} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold mb-3 ${
                    color === "blue"
                      ? "bg-blue-500/20 text-blue-400"
                      : color === "purple"
                      ? "bg-purple-500/20 text-purple-400"
                      : "bg-green-500/20 text-green-400"
                  }`}
                >
                  {step}
                </div>
                <h3 className="font-semibold text-white mb-1">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}
