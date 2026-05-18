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
  const [showPractice, setShowPractice] = useState(false);

  // Per-card inline videos: index → video url or "__error__"
  const [practiceVideos, setPracticeVideos] = useState<Record<number, string>>({});
  const [loadingPracticeVideo, setLoadingPracticeVideo] = useState<number | null>(null);

  // Modal video player
  const [modalVideo, setModalVideo] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setIsMounted(true); }, []);

  const resetState = () => {
    setAnimationUrl(null);
    setErrorMsg(null);
    setStatus("idle");
    setPracticeProblems([]);
    setIsLoadingPractice(false);
    setShowPractice(false);
    setPracticeVideos({});
    setLoadingPracticeVideo(null);
    setModalVideo(null);
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

  const handleSolve = async (overrideText?: string) => {
    const textToUse = overrideText ?? problemText;
    if (!uploadedFile && !textToUse.trim()) return;

    setStatus("processing");
    setAnimationUrl(null);
    setErrorMsg(null);
    setPracticeProblems([]);
    setIsLoadingPractice(false);
    setShowPractice(false);
    setPracticeVideos({});
    setLoadingPracticeVideo(null);

    const capturedProblem = textToUse.trim();

    try {
      // Step 1: Get Manim code from AI
      const formData = new FormData();
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
      setShowPractice(true);
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

  // Generate an inline video for a specific practice card without replacing the main video
  const handlePracticeVideoWalkthrough = async (problem: string, index: number) => {
    if (loadingPracticeVideo !== null) return;
    setLoadingPracticeVideo(index);
    setPracticeVideos(prev => { const n = { ...prev }; delete n[index]; return n; });

    try {
      const formData = new FormData();
      formData.append("problemText", problem);
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

      setPracticeVideos(prev => ({ ...prev, [index]: `data:video/mp4;base64,${renderData.videoBase64}` }));
    } catch {
      setPracticeVideos(prev => ({ ...prev, [index]: "__error__" }));
    } finally {
      setLoadingPracticeVideo(null);
    }
  };

  const canSolve =
    (!!uploadedFile || problemText.trim().length > 0) &&
    status !== "processing" &&
    status !== "rendering";

  if (!isMounted) return <div className="min-h-screen bg-gray-50 dark:bg-gray-950" />;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <Header />

      <main className="flex-grow flex flex-col items-center px-4 py-12 gap-10">

        {/* Hero */}
        {status !== "done" && (
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3 tracking-tight">
            Visual STEM Tutor
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            Upload a problem or type it below. We&apos;ll generate a step-by-step animated solution.
          </p>
        </div>
        )}

        {/* Input Card */}
        {status !== "done" && (
        <div className="w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 flex flex-col gap-5 shadow-xl">

          {/* File Upload */}
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Upload a file (optional)</p>
            <div
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-blue-500 bg-blue-500/10"
                  : uploadedFile
                  ? "border-green-500 bg-green-500/10"
                  : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
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
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{uploadedFile.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setUploadedFile(null); resetState(); }}
                    className="ml-2 text-gray-400 hover:text-red-400 transition-colors"
                    title="Remove file"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <svg className="h-8 w-8 text-gray-400 dark:text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Drag & drop or <span className="text-blue-500 dark:text-blue-400">browse</span></p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">PDF, JPG, PNG</p>
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
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
            <span className="text-xs text-gray-400 dark:text-gray-600 uppercase tracking-wider">or type your problem</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          </div>

          {/* Text Input */}
          <textarea
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none transition-colors"
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
                : "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
            }`}
          >
            Solve &amp; Animate
          </button>
        </div>
        )}

        {/* Status / Results */}
        {status !== "idle" && (
          <div className="w-full max-w-3xl flex flex-col gap-6">

            {/* Processing */}
            {status === "processing" && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-10 flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-700 dark:text-gray-300 font-medium">Analyzing problem...</p>
                <p className="text-gray-500 text-sm">The AI is reading your problem and generating the animation code</p>
              </div>
            )}

            {/* Rendering */}
            {status === "rendering" && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-10 flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-700 dark:text-gray-300 font-medium">Rendering animation...</p>
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
                  className="self-start text-sm text-blue-500 dark:text-blue-400 hover:underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Main Video */}
            {status === "done" && animationUrl && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Step-by-step Animation</p>
                </div>
                <div className="bg-black">
                  <video
                    className="w-full"
                    controls
                    autoPlay
                    loop
                    playsInline
                  >
                    <source src={animationUrl} type="video/mp4" />
                  </video>
                </div>
              </div>
            )}

            {/* Practice Problems */}
            {showPractice && (isLoadingPractice || practiceProblems.length > 0) && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Practice Problems</h3>
                    {isLoadingPractice && (
                      <div className="w-3.5 h-3.5 border border-gray-400 dark:border-gray-500 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  {!isLoadingPractice && practiceProblems.length > 0 && practiceProblems[0] !== "__error__" && (
                    <button
                      onClick={() => {
                        setPracticeProblems([]);
                        setPracticeVideos({});
                        setLoadingPracticeVideo(null);
                        setIsLoadingPractice(true);
                        const problemToUse = problemText.trim() || "a math problem";
                        fetch("/api/generate-practice", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ originalProblem: problemToUse }),
                        })
                          .then((r) => r.json())
                          .then((data) => {
                            if (data.problems?.length > 0) {
                              setPracticeProblems(data.problems);
                            } else {
                              setPracticeProblems(["__error__"]);
                            }
                          })
                          .catch(() => setPracticeProblems(["__error__"]))
                          .finally(() => setIsLoadingPractice(false));
                      }}
                      className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      New set
                    </button>
                  )}
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  {isLoadingPractice && practiceProblems.length === 0
                    ? [0, 1, 2].map((i) => (
                        <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 animate-pulse">
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-2 w-4/5" />
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-2 w-3/5" />
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-5 w-2/5" />
                          <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg w-full" />
                        </div>
                      ))
                    : practiceProblems[0] === "__error__"
                    ? (
                        <div className="col-span-3 text-sm text-gray-500 py-2">
                          Could not load practice problems.
                        </div>
                      )
                    : practiceProblems.map((problem, i) => (
                        <div
                          key={i}
                          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col gap-3 transition-colors"
                        >
                          {/* Problem number + text */}
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 dark:text-blue-400 text-xs flex items-center justify-center font-semibold mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{problem}</p>
                          </div>

                          {/* Button: generate → loading → See Video */}
                          {practiceVideos[i] && practiceVideos[i] !== "__error__" ? (
                            <button
                              onClick={() => setModalVideo(practiceVideos[i])}
                              className="w-full py-2 rounded-lg text-sm font-medium transition-all
                                bg-green-600 hover:bg-green-500 text-white
                                flex items-center justify-center gap-1.5"
                            >
                              See Video
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          ) : practiceVideos[i] === "__error__" ? (
                            <button
                              onClick={() => handlePracticeVideoWalkthrough(problem, i)}
                              disabled={loadingPracticeVideo !== null}
                              className="w-full py-2 rounded-lg text-sm font-medium transition-all
                                bg-red-900/40 hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400 hover:text-gray-500 dark:hover:text-gray-400
                                border border-red-800/50 hover:border-gray-200 dark:hover:border-gray-700
                                flex items-center justify-center gap-1.5
                                disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Retry
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePracticeVideoWalkthrough(problem, i)}
                              disabled={loadingPracticeVideo !== null}
                              className="w-full py-2 rounded-lg text-sm font-medium transition-all
                                bg-gray-100 dark:bg-gray-800 hover:bg-blue-600 text-gray-600 dark:text-gray-400 hover:text-white
                                border border-gray-200 dark:border-gray-700 hover:border-blue-500
                                flex items-center justify-center gap-1.5
                                disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loadingPracticeVideo === i ? (
                                <>
                                  <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  Video Walkthrough
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </>
                              )}
                            </button>
                          )}

                        </div>
                      ))}
                </div>
              </div>
            )}

            {/* Solve Another Problem */}
            {status === "done" && (
              <button
                onClick={() => {
                  setStatus("idle");
                  setAnimationUrl(null);
                  setUploadedFile(null);
                  setProblemText("");
                  setPracticeProblems([]);
                  setIsLoadingPractice(false);
                  setShowPractice(false);
                  setPracticeVideos({});
                  setLoadingPracticeVideo(null);
                  setModalVideo(null);
                }}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all
                  bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700
                  text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white
                  border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500
                  flex items-center justify-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Solve Another Problem
              </button>
            )}

          </div>
        )}

        {/* How It Works */}
        <div className="w-full max-w-3xl mt-4">
          <h2 className="text-center text-xl font-semibold text-gray-500 dark:text-gray-400 mb-6">How it works</h2>
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
              <div key={step} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold mb-3 ${
                    color === "blue"
                      ? "bg-blue-500/20 text-blue-500 dark:text-blue-400"
                      : color === "purple"
                      ? "bg-purple-500/20 text-purple-500 dark:text-purple-400"
                      : "bg-green-500/20 text-green-500 dark:text-green-400"
                  }`}
                >
                  {step}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>

      </main>

      <Footer />

      {/* Video Modal */}
      {modalVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setModalVideo(null)}
        >
          <div
            className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Practice Problem — Step-by-step Solution</p>
              <button
                onClick={() => setModalVideo(null)}
                className="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Video */}
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
