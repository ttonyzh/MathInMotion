import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import Link from "next/link";

const steps = [
  {
    number: "01",
    color: "blue",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    title: "Give it your problem",
    summary: "Type it out, snap a photo, or upload a file — whatever's easiest.",
    details: [
      "Type any problem in plain English. No special formatting needed.",
      "Upload a photo of your textbook, worksheet, or handwritten notes.",
      "Attach a PDF and we'll find the problem automatically.",
      "Works for algebra, calculus, geometry, trigonometry, statistics, and more.",
    ],
  },
  {
    number: "02",
    color: "purple",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: "AI works through it",
    summary: "Our AI reads your problem and reasons through every step before building your animation.",
    details: [
      "It understands what the problem is actually asking — not just the numbers.",
      "It reasons through the solution the same way a tutor would, step by step.",
      "It also writes a plain-English explanation so you can read along.",
      "It's trained specifically for math — it knows order of operations, equation formatting, and common problem types.",
    ],
  },
  {
    number: "03",
    color: "orange",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      </svg>
    ),
    title: "Your animation is created",
    summary: "We render a custom video for your exact problem — not a generic example.",
    details: [
      "Every animation is generated fresh for your specific problem.",
      "Steps appear one at a time so you can follow along easily.",
      "The final answer is highlighted so you always know where you're headed.",
      "This usually takes 20–60 seconds depending on how complex the problem is.",
    ],
  },
  {
    number: "04",
    color: "green",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Watch, read, and practice",
    summary: "Learn from the animation, then test yourself with similar problems.",
    details: [
      "Watch the video as many times as you need — it loops automatically.",
      "Read the written explanation below if you prefer text over video.",
      "Three similar practice problems are generated automatically after every solution.",
      "Each practice problem has its own animated walkthrough if you get stuck.",
    ],
  },
];

const colorMap: Record<string, string> = {
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  purple: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
  orange: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20",
  green: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20",
};

const numberColorMap: Record<string, string> = {
  blue: "text-blue-200 dark:text-blue-900",
  purple: "text-purple-200 dark:text-purple-900",
  orange: "text-orange-200 dark:text-orange-900",
  green: "text-green-200 dark:text-green-900",
};

const faqs = [
  {
    q: "What subjects does it support?",
    a: "Algebra, geometry, trigonometry, calculus, statistics, and pre-calculus. If it's a math problem and you can write it out, it can almost certainly solve it.",
  },
  {
    q: "Why does it take a minute to generate?",
    a: "Every animation is built from scratch for your exact problem. Think of it like a tutor sitting down and drawing out the solution — it takes a little time, but the result is completely personalized.",
  },
  {
    q: "Can I upload a photo of handwritten work?",
    a: "Yes. Upload JPG or PNG images and the AI will read your handwriting and extract the problem automatically.",
  },
  {
    q: "What if the animation looks wrong?",
    a: "Try rephrasing the problem with a bit more detail, or type it out instead of uploading. The clearer the input, the better the output.",
  },
  {
    q: "Are my problems saved anywhere?",
    a: "Your recent problems are saved in your browser history so you can re-solve them in one click. Nothing is stored on any server.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <Header />

      <main className="flex-grow px-4 py-16 flex flex-col items-center gap-16">

        {/* Page header */}
        <div className="text-center max-w-2xl">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-blue-500 dark:text-blue-400 mb-3 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
            How it works
          </span>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">From problem to animation in four steps</h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed">
            No setup, no account, no waiting — just paste your problem and get a video back.
          </p>
        </div>

        {/* Steps */}
        <div className="w-full max-w-3xl flex flex-col gap-5">
          {steps.map(({ number, color, icon, title, summary, details }) => (
            <div
              key={number}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 flex gap-5 shadow-sm"
            >
              <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border ${colorMap[color]}`}>
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3 mb-1">
                  <span className={`text-xs font-bold tabular-nums ${numberColorMap[color]}`}>{number}</span>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-3">{summary}</p>
                <ul className="flex flex-col gap-2">
                  {details.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="w-full max-w-3xl">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">Common questions</h2>
          <div className="flex flex-col gap-3">
            {faqs.map(({ q, a }) => (
              <div
                key={q}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5"
              >
                <p className="font-semibold text-gray-900 dark:text-white mb-1.5">{q}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
          >
            Try it now
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>

      </main>

      <Footer />
    </div>
  );
}
