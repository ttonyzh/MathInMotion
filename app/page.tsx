"use client";

import { useState, useEffect, useRef } from "react";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";

type Status = "idle" | "processing" | "rendering" | "done" | "error";

interface HistoryEntry {
  text: string;
  timestamp: number;
}

function parseSolutionSteps(text: string): string[] {
  const byNewline = text.split('\n').map(s => s.trim()).filter(Boolean);
  if (byNewline.length > 1) return byNewline;
  const bySentence = text.match(/[^.!?]+[.!?]+/g);
  if (bySentence && bySentence.length > 1) return bySentence.map(s => s.trim()).filter(Boolean);
  return [text];
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

const MATH_SYMBOLS = [
  { sym: "∫",  left: "8%",  top: "18%", size: 52, rot: -15, op: 0.045, dur: "9s",  delay: "0s"   },
  { sym: "Σ",  left: "88%", top: "12%", size: 44, rot:  12, op: 0.04,  dur: "11s", delay: "1.5s" },
  { sym: "π",  left: "78%", top: "72%", size: 60, rot:  -8, op: 0.05,  dur: "13s", delay: "3s"   },
  { sym: "√",  left: "20%", top: "78%", size: 48, rot:  18, op: 0.04,  dur: "10s", delay: "2s"   },
  { sym: "∞",  left: "55%", top: "8%",  size: 40, rot:   5, op: 0.035, dur: "14s", delay: "4s"   },
  { sym: "θ",  left: "93%", top: "45%", size: 50, rot: -20, op: 0.04,  dur: "12s", delay: "0.5s" },
  { sym: "Δ",  left: "3%",  top: "55%", size: 44, rot:  10, op: 0.035, dur: "15s", delay: "5s"   },
  { sym: "dx", left: "65%", top: "88%", size: 36, rot:  -5, op: 0.04,  dur: "8s",  delay: "2.5s" },
];

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [problemText, setProblemText] = useState("");
  const [animationUrl, setAnimationUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [solutionText, setSolutionText] = useState<string | null>(null);
  const [showSolution, setShowSolution] = useState(true);
  const [citations, setCitations] = useState<{source: string; chapter: string}[]>([]);
  const [practiceProblems, setPracticeProblems] = useState<string[]>([]);
  const [isLoadingPractice, setIsLoadingPractice] = useState(false);
  const [showPractice, setShowPractice] = useState(false);
  const [practiceVideos, setPracticeVideos] = useState<Record<number, string>>({});
  const [loadingPracticeVideo, setLoadingPracticeVideo] = useState<number | null>(null);
  const [modalVideo, setModalVideo] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem("tutor-history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  const saveToHistory = (text: string) => {
    if (!text.trim()) return;
    try {
      const saved = localStorage.getItem("tutor-history");
      const existing: HistoryEntry[] = JSON.parse(saved || "[]");
      const updated = [
        { text, timestamp: Date.now() },
        ...existing.filter((h) => h.text !== text),
      ].slice(0, 20);
      setHistory(updated);
      localStorage.setItem("tutor-history", JSON.stringify(updated));
    } catch {}
  };

  const deleteFromHistory = (timestamp: number) => {
    const updated = history.filter((h) => h.timestamp !== timestamp);
    setHistory(updated);
    localStorage.setItem("tutor-history", JSON.stringify(updated));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("tutor-history");
  };

  const resetState = () => {
    setAnimationUrl(null);
    setErrorMsg(null);
    setStatus("idle");
    setSolutionText(null);
    setShowSolution(true);
    setCitations([]);
    setPracticeProblems([]);
    setIsLoadingPractice(false);
    setShowPractice(false);
    setPracticeVideos({});
    setLoadingPracticeVideo(null);
    setModalVideo(null);
  };

  const handleFileSelect = (file: File) => { setUploadedFile(file); resetState(); };
  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleSolve = async (overrideText?: string) => {
    const textToUse = overrideText ?? problemText;
    if (!uploadedFile && !textToUse.trim()) return;

    setStatus("processing");
    setAnimationUrl(null); setErrorMsg(null); setSolutionText(null);
    setShowSolution(true); setPracticeProblems([]); setIsLoadingPractice(false);
    setShowPractice(false); setPracticeVideos({}); setLoadingPracticeVideo(null);

    const capturedProblem = textToUse.trim();
    try {
      const formData = new FormData();
      if (uploadedFile && !overrideText) formData.append("file", uploadedFile);
      if (textToUse.trim()) formData.append("problemText", textToUse.trim());

      const processRes  = await fetch("/api/process-problem", { method: "POST", body: formData });
      const processData = await processRes.json();
      if (!processData.success || !processData.manimCode)
        throw new Error(processData.error || "Failed to generate animation code. Please try again.");

      const solutionFromAPI: string | null = processData.solution?.trim() || null;
      setStatus("rendering");

      const renderRes  = await fetch("/api/render-manim", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manimCode: processData.manimCode }),
      });
      const renderData = await renderRes.json();
      if (!renderData.success || !renderData.videoBase64)
        throw new Error(renderData.error || "Failed to render animation.");

      setAnimationUrl(`data:video/mp4;base64,${renderData.videoBase64}`);
      setStatus("done"); setSolutionText(solutionFromAPI);
      setCitations(processData.citations ?? []);
      setShowPractice(true); setIsLoadingPractice(true);
      saveToHistory(capturedProblem);

      fetch("/api/generate-practice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalProblem: capturedProblem || "a math problem" }),
      })
        .then(r => r.json())
        .then(data => { setPracticeProblems(data.problems?.length > 0 ? data.problems : ["__error__"]); })
        .catch(() => setPracticeProblems(["__error__"]))
        .finally(() => setIsLoadingPractice(false));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  const handlePracticeVideoWalkthrough = async (problem: string, index: number) => {
    if (loadingPracticeVideo !== null) return;
    setLoadingPracticeVideo(index);
    setPracticeVideos(prev => { const n = { ...prev }; delete n[index]; return n; });
    try {
      const formData = new FormData();
      formData.append("problemText", problem);
      const processRes  = await fetch("/api/process-problem", { method: "POST", body: formData });
      const processData = await processRes.json();
      if (!processData.success || !processData.manimCode) throw new Error("Failed to generate code");
      const renderRes  = await fetch("/api/render-manim", {
        method: "POST", headers: { "Content-Type": "application/json" },
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

  const canSolve = (!!uploadedFile || problemText.trim().length > 0) &&
    status !== "processing" && status !== "rendering";

  if (!isMounted) return <div className="min-h-screen bg-white dark:bg-[#04040c]" />;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#04040c] text-gray-900 dark:text-white relative overflow-x-hidden">

      {/* ── Moving ambient blobs ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="blob1 absolute -top-40 left-[15%] w-[600px] h-[600px] rounded-full bg-indigo-600/[0.08] dark:bg-indigo-600/[0.13] blur-[110px]" />
        <div className="blob2 absolute top-[40%] -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/[0.07] dark:bg-violet-600/[0.11] blur-[100px]" />
        <div className="blob3 absolute -bottom-40 left-[30%] w-[550px] h-[550px] rounded-full bg-blue-600/[0.06] dark:bg-blue-600/[0.09] blur-[120px]" />
      </div>

      {/* ── History sidebar backdrop ── */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setIsHistoryOpen(false)} />
      )}

      {/* ── History sidebar ── */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-white dark:bg-[#09091a] border-r border-gray-200 dark:border-white/[0.07] shadow-2xl shadow-black/40 transition-transform duration-300 ease-out ${isHistoryOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <svg className="h-3.5 w-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">History</h2>
          </div>
          <div className="flex items-center gap-1">
            {history.length > 0 && (
              <button onClick={clearHistory} className="text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                Clear all
              </button>
            )}
            <button onClick={() => setIsHistoryOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.07] rounded-lg transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {history.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                <svg className="h-5 w-5 text-gray-300 dark:text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400 dark:text-gray-600">No problems solved yet</p>
            </div>
          ) : (
            history.map((item) => (
              <div key={item.timestamp} className="group px-2 py-0.5">
                <div className="flex items-start gap-2.5 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] cursor-pointer transition-colors" onClick={() => { setIsHistoryOpen(false); setProblemText(item.text); handleSolve(item.text); }}>
                  <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">
                      {item.text ? (item.text.length > 72 ? item.text.slice(0, 72).trimEnd() + "…" : item.text) : "[File upload]"}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{timeAgo(item.timestamp)}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteFromHistory(item.timestamp); }} className="shrink-0 opacity-0 group-hover:opacity-100 p-1 text-gray-300 dark:text-gray-700 hover:text-red-400 rounded transition-all">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Header onHistoryClick={() => setIsHistoryOpen(true)} historyCount={history.length} />

      <main className="flex-grow flex flex-col items-center px-4 py-16 gap-12 relative">

        {/* ── Hero ── */}
        {status !== "done" && (
          <div className="relative text-center max-w-2xl space-y-6 pt-4">

            {/* Dot grid */}
            <div className="absolute inset-x-[-10vw] top-[-4rem] h-80 dot-grid opacity-30 dark:opacity-100 pointer-events-none" />

            {/* Glow orb behind text */}
            <div className="absolute left-1/2 top-12 -translate-x-1/2 w-72 h-32 bg-indigo-500/20 dark:bg-indigo-500/15 blur-3xl rounded-full pointer-events-none" />

            {/* Floating math symbols */}
            <div className="absolute inset-x-[-12vw] inset-y-0 pointer-events-none select-none hidden lg:block">
              {MATH_SYMBOLS.map(({ sym, left, top, size, rot, op, dur, delay }) => (
                <span
                  key={sym}
                  className="math-sym absolute font-bold text-gray-900 dark:text-white"
                  style={{
                    left, top,
                    fontSize: size,
                    '--rot': `${rot}deg`,
                    '--op': op,
                    '--dur': dur,
                    '--delay': delay,
                    opacity: op,
                    transform: `rotate(${rot}deg)`,
                  } as React.CSSProperties}
                >
                  {sym}
                </span>
              ))}
            </div>

            {/* Badge */}
            <div className="relative inline-flex items-center gap-2 bg-white dark:bg-indigo-500/[0.08] border border-gray-200 dark:border-indigo-500/25 rounded-full px-4 py-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">AI-Powered STEM Learning</span>
            </div>

            {/* Headline */}
            <h1 className="relative text-6xl sm:text-7xl font-bold tracking-tight leading-[1.04]">
              <span className="hidden dark:inline shimmer-text">Math, animated.</span>
              <span className="dark:hidden shimmer-text-light">Math, animated.</span>
            </h1>

            <p className="relative text-gray-500 dark:text-gray-400 text-lg leading-relaxed max-w-md mx-auto">
              Type or upload any math problem and get a beautiful step-by-step animated video that shows you exactly how to solve it.
            </p>
          </div>
        )}

        {/* ── Input Card ── */}
        {status !== "done" && (
          <div className="relative w-full max-w-xl">
            {/* Card glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600/20 via-violet-600/20 to-indigo-600/20 rounded-3xl blur-xl opacity-0 dark:opacity-100 pointer-events-none" />

            <div className="card-sheen relative bg-white dark:bg-[rgba(255,255,255,0.028)] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-6 flex flex-col gap-5 backdrop-blur-md">

              {/* Upload zone */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-2.5">Upload a file <span className="normal-case font-normal">(optional)</span></p>
                <div
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/[0.08] scale-[1.01]"
                      : uploadedFile
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/[0.06]"
                      : "border-gray-200 dark:border-white/[0.08] hover:border-indigo-400 dark:hover:border-indigo-500/40 hover:bg-gray-50/80 dark:hover:bg-white/[0.02]"
                  }`}
                >
                  {uploadedFile ? (
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <svg className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" style={{width:18,height:18}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{uploadedFile.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setUploadedFile(null); resetState(); }} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center mb-2.5">
                        <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Drag & drop or <span className="text-indigo-600 dark:text-indigo-400 font-semibold">browse</span></p>
                      <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">PDF · JPG · PNG</p>
                    </>
                  )}
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }} />
                </div>
                {uploadedFile && !problemText.trim() && (
                  <p className="text-xs text-amber-500 dark:text-amber-400 mt-2 flex items-center gap-1.5">
                    <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Add a description so this gets saved to history.
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100 dark:bg-white/[0.05]" />
                <span className="text-[11px] text-gray-400 dark:text-gray-600 uppercase tracking-widest font-medium">or type your problem</span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-white/[0.05]" />
              </div>

              {/* Textarea */}
              <textarea
                className="w-full bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/10 resize-none transition-all"
                rows={4}
                placeholder="e.g. Solve for x: 2x + 5 = 4"
                value={problemText}
                onChange={(e) => { setProblemText(e.target.value); resetState(); }}
              />

              {/* CTA */}
              <button
                onClick={() => handleSolve()}
                disabled={!canSolve}
                className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 ${
                  canSolve
                    ? "glow-btn bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-[length:200%_100%] hover:bg-right text-white hover:scale-[1.015] active:scale-[0.985]"
                    : "bg-gray-100 dark:bg-white/[0.04] text-gray-400 dark:text-gray-600 cursor-not-allowed"
                }`}
              >
                Solve &amp; Animate
              </button>
            </div>
          </div>
        )}

        {/* ── Status / Results ── */}
        {status !== "idle" && (
          <div className="w-full max-w-3xl flex flex-col gap-6">

            {/* Processing */}
            {status === "processing" && (
              <div className="card-sheen bg-white dark:bg-white/[0.025] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-14 flex flex-col items-center gap-6 backdrop-blur-sm">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-20 h-20 rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 blur-xl" />
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-full border-2 border-indigo-500/15" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin" />
                    <div className="absolute inset-2 rounded-full border border-transparent border-t-violet-400 animate-spin" style={{animationDuration:'1.5s'}} />
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <p className="font-semibold text-gray-900 dark:text-white">Analyzing problem…</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">The AI is reading your problem and writing the animation</p>
                </div>
              </div>
            )}

            {/* Rendering */}
            {status === "rendering" && (
              <div className="card-sheen bg-white dark:bg-white/[0.025] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-14 flex flex-col items-center gap-6 backdrop-blur-sm">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-20 h-20 rounded-full bg-violet-500/10 dark:bg-violet-500/15 blur-xl" />
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-full border-2 border-violet-500/15" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-500 animate-spin" />
                    <div className="absolute inset-2 rounded-full border border-transparent border-t-pink-400 animate-spin" style={{animationDuration:'1.5s'}} />
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <p className="font-semibold text-gray-900 dark:text-white">Rendering animation…</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Manim is generating your step-by-step video</p>
                </div>
              </div>
            )}

            {/* Error */}
            {status === "error" && (
              <div className="bg-red-50 dark:bg-red-500/[0.06] border border-red-200 dark:border-red-500/20 rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-400 pt-1 leading-relaxed">{errorMsg}</p>
                </div>
                <button onClick={() => handleSolve()} className="self-start text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-2">
                  Try again →
                </button>
              </div>
            )}

            {/* Main Video */}
            {status === "done" && animationUrl && (
              <div className="card-sheen grad-border bg-white dark:bg-white/[0.025] border border-gray-200 dark:border-white/[0.07] rounded-2xl overflow-hidden shadow-2xl shadow-black/10 dark:shadow-indigo-950/60 backdrop-blur-sm">
                <div className="px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                    </div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-1">Step-by-step Animation</p>
                  </div>
                </div>
                <div className="bg-black">
                  <video className="w-full" controls autoPlay loop playsInline>
                    <source src={animationUrl} type="video/mp4" />
                  </video>
                </div>
              </div>
            )}

            {/* Written Explanation */}
            {status === "done" && solutionText && (
              <div className="card-sheen bg-white dark:bg-white/[0.025] border border-gray-200 dark:border-white/[0.07] rounded-2xl overflow-hidden backdrop-blur-sm">
                <button
                  onClick={() => setShowSolution(!showSolution)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                      <svg className="h-3.5 w-3.5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Written Explanation</p>
                  </div>
                  <svg className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${showSolution ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showSolution && (
                  <div className="px-5 pb-5 pt-1 flex flex-col gap-3 border-t border-gray-100 dark:border-white/[0.05]">
                    {parseSolutionSteps(solutionText).map((step, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-violet-600 dark:text-violet-400 text-xs flex items-center justify-center font-bold mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Citations */}
            {status === "done" && citations.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">Sources</span>
                {citations.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-500/[0.08] border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-medium px-3 py-1 rounded-full">
                    <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    {c.source} · {c.chapter}
                  </span>
                ))}
              </div>
            )}

            {/* Practice Problems */}
            {showPractice && (isLoadingPractice || practiceProblems.length > 0) && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">Practice Problems</h3>
                    {isLoadingPractice && <div className="w-3.5 h-3.5 border border-gray-300 dark:border-gray-600 border-t-indigo-500 rounded-full animate-spin" />}
                  </div>
                  {!isLoadingPractice && practiceProblems.length > 0 && practiceProblems[0] !== "__error__" && (
                    <button
                      onClick={() => {
                        setPracticeProblems([]); setPracticeVideos({}); setLoadingPracticeVideo(null); setIsLoadingPractice(true);
                        fetch("/api/generate-practice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ originalProblem: problemText.trim() || "a math problem" }) })
                          .then(r => r.json()).then(data => { setPracticeProblems(data.problems?.length > 0 ? data.problems : ["__error__"]); })
                          .catch(() => setPracticeProblems(["__error__"])).finally(() => setIsLoadingPractice(false));
                      }}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors font-medium"
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
                    ? [0,1,2].map(i => (
                        <div key={i} className="bg-white dark:bg-white/[0.025] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4 animate-pulse">
                          <div className="h-2.5 bg-gray-100 dark:bg-white/[0.07] rounded-full mb-2.5 w-4/5" />
                          <div className="h-2.5 bg-gray-100 dark:bg-white/[0.07] rounded-full mb-2.5 w-3/5" />
                          <div className="h-2.5 bg-gray-100 dark:bg-white/[0.07] rounded-full mb-5 w-2/5" />
                          <div className="h-8 bg-gray-50 dark:bg-white/[0.04] rounded-lg" />
                        </div>
                      ))
                    : practiceProblems[0] === "__error__"
                    ? <div className="col-span-3 text-sm text-gray-400 py-2">Could not load practice problems.</div>
                    : practiceProblems.map((problem, i) => (
                        <div key={i} className="grad-border card-sheen bg-white dark:bg-white/[0.025] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 backdrop-blur-sm">
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-indigo-600 dark:text-indigo-400 text-xs flex items-center justify-center font-bold mt-0.5">{i + 1}</span>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{problem}</p>
                          </div>
                          {practiceVideos[i] && practiceVideos[i] !== "__error__" ? (
                            <button onClick={() => setModalVideo(practiceVideos[i])} className="w-full py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/20 transition-all">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              See Video
                            </button>
                          ) : practiceVideos[i] === "__error__" ? (
                            <button onClick={() => handlePracticeVideoWalkthrough(problem, i)} disabled={loadingPracticeVideo !== null} className="w-full py-2 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-500/[0.07] hover:bg-gray-50 dark:hover:bg-white/[0.04] text-red-500 border border-red-200 dark:border-red-500/20 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                              Retry
                            </button>
                          ) : (
                            <button onClick={() => handlePracticeVideoWalkthrough(problem, i)} disabled={loadingPracticeVideo !== null} className="w-full py-2 rounded-lg text-sm font-medium bg-gray-50 dark:bg-white/[0.04] hover:bg-gradient-to-r hover:from-indigo-600 hover:to-violet-600 text-gray-500 dark:text-gray-400 hover:text-white border border-gray-200 dark:border-white/[0.07] hover:border-transparent flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
                              {loadingPracticeVideo === i ? (
                                <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />Generating…</>
                              ) : (
                                <>Video Walkthrough <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></>
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                </div>
              </div>
            )}

            {/* Solve Another */}
            {status === "done" && (
              <button
                onClick={() => { setStatus("idle"); setAnimationUrl(null); setUploadedFile(null); setProblemText(""); setSolutionText(null); setShowSolution(true); setPracticeProblems([]); setIsLoadingPractice(false); setShowPractice(false); setPracticeVideos({}); setLoadingPracticeVideo(null); setModalVideo(null); }}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all bg-white dark:bg-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.07] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.15] flex items-center justify-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Solve Another Problem
              </button>
            )}
          </div>
        )}

        {/* ── How It Works ── */}
        <div className="w-full max-w-4xl mt-8">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-3">The Process</p>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">How it works</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-5 relative">
            <div className="hidden sm:block absolute top-9 left-[calc(33.33%+24px)] right-[calc(33.33%+24px)] h-px">
              <div className="h-full bg-gradient-to-r from-indigo-400/30 via-violet-400/30 to-emerald-400/30" />
            </div>
            {[
              { icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>, from: "from-blue-500", to: "to-indigo-600", glow: "group-hover:shadow-indigo-500/30", title: "Upload or Type",   desc: "Submit a photo, PDF, or type your math problem. Algebra, calculus, geometry — anything." },
              { icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>, from: "from-violet-500", to: "to-purple-600", glow: "group-hover:shadow-violet-500/30", title: "AI Figures It Out", desc: "GPT-4 Vision analyzes your problem and generates a personalized Manim animation." },
              { icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, from: "from-emerald-500", to: "to-teal-600", glow: "group-hover:shadow-emerald-500/30", title: "Watch & Learn",    desc: "A smooth animated video walks through every step with a written breakdown too." },
            ].map(({ icon, from, to, glow, title, desc }, i) => (
              <div key={i} className={`group card-sheen grad-border relative bg-white dark:bg-white/[0.025] border border-gray-200 dark:border-white/[0.07] rounded-2xl p-6 flex flex-col gap-4 hover:shadow-xl ${glow} transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm`}>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${from} ${to} flex items-center justify-center text-white shadow-lg`}>
                  {icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1.5">{title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
                </div>
                <span className="absolute top-5 right-5 text-xs font-bold text-gray-200 dark:text-white/[0.05] tabular-nums select-none">0{i+1}</span>
              </div>
            ))}
          </div>
        </div>

      </main>

      <Footer />

      {/* ── Video Modal ── */}
      {modalVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xl p-4" onClick={() => setModalVideo(null)}>
          <div className="relative w-full max-w-4xl bg-white dark:bg-[#09091a] rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-white/[0.09] card-sheen" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-1">Practice Problem — Step-by-step Solution</p>
              </div>
              <button onClick={() => setModalVideo(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.07]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
