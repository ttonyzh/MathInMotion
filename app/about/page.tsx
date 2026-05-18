import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <Header />

      <main className="flex-grow px-4 py-16 flex flex-col items-center gap-12">

        {/* Header */}
        <div className="text-center max-w-2xl">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-blue-500 dark:text-blue-400 mb-3 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
            About
          </span>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">Built for students who learn better visually</h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed">
            MathInMotion turns any math problem into a step-by-step animated video — the way math should be taught.
          </p>
        </div>

        {/* Story */}
        <div className="w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-sm flex flex-col gap-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Why this exists</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Reading a worked example in a textbook is one thing. Watching it unfold step by step — with each operation appearing at just the right moment — actually makes it click.
          </p>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            MathInMotion was built to make that kind of explanation available for <em>any</em> problem, not just the ones a textbook happened to include. Paste your homework question, get back a video that walks you through the solution like a patient tutor would.
          </p>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            After each solution, you also get three similar practice problems — each with its own animated walkthrough if you need a hint.
          </p>
        </div>

        {/* What it supports */}
        <div className="w-full max-w-2xl flex flex-col gap-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">What it handles</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: "Algebra", desc: "Linear equations, quadratics, systems, inequalities, factoring" },
              { title: "Calculus", desc: "Derivatives, integrals, limits, chain rule, optimization" },
              { title: "Geometry", desc: "Area, perimeter, angles, Pythagorean theorem, circles" },
              { title: "Trigonometry", desc: "SOH-CAH-TOA, unit circle, sine and cosine rules" },
              { title: "Statistics", desc: "Mean, median, mode, standard deviation, probability" },
              { title: "Pre-calculus", desc: "Functions, logarithms, exponents, sequences and series" },
            ].map(({ title, desc }) => (
              <div key={title} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex gap-3">
                <span className="mt-1 shrink-0 w-2 h-2 rounded-full bg-blue-500" />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center flex flex-col items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
          >
            Try it now
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
          <Link href="/examples" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
            See example problems
          </Link>
        </div>

      </main>

      <Footer />
    </div>
  );
}
