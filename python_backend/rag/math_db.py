"""
RAG knowledge base for MathInMotion.
Seeds ChromaDB with math content and provides a retrieve() function.
"""

import chromadb
from pathlib import Path

DB_PATH = str(Path(__file__).parent / "chroma_db")

MATH_CHUNKS = [
    # ── Algebra ──────────────────────────────────────────────────────────────
    {
        "id": "alg-linear-1",
        "text": "A linear equation is an equation of the form ax + b = c, where a, b, and c are constants and a ≠ 0. To solve, isolate x by performing the same operation on both sides: subtract b from both sides to get ax = c - b, then divide both sides by a to get x = (c - b) / a.",
        "source": "OpenStax Algebra", "chapter": "Ch. 2 — Linear Equations",
    },
    {
        "id": "alg-linear-2",
        "text": "When solving linear equations with variables on both sides, collect all variable terms on one side and all constant terms on the other. Example: 3x + 5 = x + 13 → subtract x from both sides → 2x + 5 = 13 → subtract 5 → 2x = 8 → divide by 2 → x = 4.",
        "source": "OpenStax Algebra", "chapter": "Ch. 2 — Linear Equations",
    },
    {
        "id": "alg-quadratic-1",
        "text": "A quadratic equation has the form ax² + bx + c = 0. It can be solved by factoring, completing the square, or the quadratic formula: x = (-b ± √(b² - 4ac)) / (2a). The discriminant b² - 4ac determines the nature of the roots: positive → two real roots, zero → one repeated root, negative → no real roots.",
        "source": "OpenStax Algebra", "chapter": "Ch. 9 — Quadratic Equations",
    },
    {
        "id": "alg-quadratic-2",
        "text": "Factoring a quadratic ax² + bx + c: find two numbers that multiply to ac and add to b. Example: x² - 5x + 6 = 0 → find factors of 6 that add to -5 → (-2) and (-3) → (x - 2)(x - 3) = 0 → x = 2 or x = 3.",
        "source": "OpenStax Algebra", "chapter": "Ch. 9 — Quadratic Equations",
    },
    {
        "id": "alg-systems-1",
        "text": "A system of linear equations can be solved by substitution or elimination. Substitution: solve one equation for one variable, substitute into the other. Elimination: add or subtract equations to eliminate one variable. A system has one solution (lines intersect), no solution (parallel lines), or infinitely many (same line).",
        "source": "OpenStax Algebra", "chapter": "Ch. 4 — Systems of Equations",
    },
    {
        "id": "alg-inequalities-1",
        "text": "Solving linear inequalities follows the same rules as equations, with one important exception: multiplying or dividing both sides by a negative number reverses the inequality sign. Example: -2x < 6 → divide by -2, flip sign → x > -3.",
        "source": "OpenStax Algebra", "chapter": "Ch. 2 — Inequalities",
    },
    {
        "id": "alg-exponents-1",
        "text": "Exponent rules: a^m · a^n = a^(m+n), a^m / a^n = a^(m-n), (a^m)^n = a^(mn), a^0 = 1, a^(-n) = 1/a^n. These apply to any nonzero base a.",
        "source": "OpenStax Algebra", "chapter": "Ch. 6 — Exponents",
    },

    # ── Calculus ─────────────────────────────────────────────────────────────
    {
        "id": "calc-deriv-1",
        "text": "The derivative of a function f(x) measures its instantaneous rate of change. The power rule: d/dx [x^n] = n·x^(n-1). Example: d/dx [x³] = 3x². The derivative of a constant is 0.",
        "source": "OpenStax Calculus Vol. 1", "chapter": "Ch. 3 — Derivatives",
    },
    {
        "id": "calc-deriv-2",
        "text": "Derivative rules: sum rule d/dx[f+g] = f'+g', product rule d/dx[fg] = f'g + fg', quotient rule d/dx[f/g] = (f'g - fg')/g², chain rule d/dx[f(g(x))] = f'(g(x))·g'(x).",
        "source": "OpenStax Calculus Vol. 1", "chapter": "Ch. 3 — Derivatives",
    },
    {
        "id": "calc-deriv-trig",
        "text": "Derivatives of trigonometric functions: d/dx[sin x] = cos x, d/dx[cos x] = -sin x, d/dx[tan x] = sec²x, d/dx[ln x] = 1/x, d/dx[e^x] = e^x.",
        "source": "OpenStax Calculus Vol. 1", "chapter": "Ch. 3 — Derivatives",
    },
    {
        "id": "calc-integral-1",
        "text": "The indefinite integral (antiderivative) reverses differentiation. Power rule for integration: ∫x^n dx = x^(n+1)/(n+1) + C, for n ≠ -1. The constant C is the constant of integration. Example: ∫3x² dx = x³ + C.",
        "source": "OpenStax Calculus Vol. 1", "chapter": "Ch. 5 — Integrals",
    },
    {
        "id": "calc-integral-2",
        "text": "The definite integral ∫[a to b] f(x) dx represents the net area under f(x) between x=a and x=b. By the Fundamental Theorem of Calculus: ∫[a to b] f(x) dx = F(b) - F(a), where F is any antiderivative of f.",
        "source": "OpenStax Calculus Vol. 1", "chapter": "Ch. 5 — Integrals",
    },
    {
        "id": "calc-limit-1",
        "text": "A limit lim(x→a) f(x) = L means f(x) gets arbitrarily close to L as x approaches a (but doesn't necessarily equal a). To evaluate: try direct substitution first. If 0/0 results, try factoring, rationalizing, or L'Hôpital's rule.",
        "source": "OpenStax Calculus Vol. 1", "chapter": "Ch. 2 — Limits",
    },

    # ── Geometry ─────────────────────────────────────────────────────────────
    {
        "id": "geo-pythagorean",
        "text": "The Pythagorean theorem states that in a right triangle with legs a and b and hypotenuse c: a² + b² = c². To find the hypotenuse: c = √(a² + b²). To find a leg: a = √(c² - b²).",
        "source": "OpenStax Geometry", "chapter": "Ch. 9 — Right Triangles",
    },
    {
        "id": "geo-circle",
        "text": "Circle formulas: circumference C = 2πr, area A = πr², where r is the radius. The diameter d = 2r. Arc length = rθ where θ is the central angle in radians.",
        "source": "OpenStax Geometry", "chapter": "Ch. 10 — Circles",
    },
    {
        "id": "geo-triangle",
        "text": "Triangle properties: the sum of interior angles is always 180°. Area = (1/2) · base · height. For any triangle with sides a, b, c and angles A, B, C opposite to them: the law of sines states a/sin A = b/sin B = c/sin C.",
        "source": "OpenStax Geometry", "chapter": "Ch. 4 — Triangles",
    },

    # ── Trigonometry ─────────────────────────────────────────────────────────
    {
        "id": "trig-sohcahtoa",
        "text": "SOH-CAH-TOA: in a right triangle, sin(θ) = Opposite/Hypotenuse, cos(θ) = Adjacent/Hypotenuse, tan(θ) = Opposite/Adjacent. To find an angle from sides, use inverse functions: θ = arcsin(O/H), θ = arccos(A/H), θ = arctan(O/A).",
        "source": "OpenStax Precalculus", "chapter": "Ch. 5 — Trigonometric Functions",
    },
    {
        "id": "trig-unit-circle",
        "text": "Key unit circle values: sin(0)=0, sin(30°)=1/2, sin(45°)=√2/2, sin(60°)=√3/2, sin(90°)=1. cos(0)=1, cos(30°)=√3/2, cos(45°)=√2/2, cos(60°)=1/2, cos(90°)=0. In radians: 30°=π/6, 45°=π/4, 60°=π/3, 90°=π/2.",
        "source": "OpenStax Precalculus", "chapter": "Ch. 5 — Trigonometric Functions",
    },
    {
        "id": "trig-identities",
        "text": "Fundamental trigonometric identities: sin²θ + cos²θ = 1 (Pythagorean identity), tan θ = sin θ / cos θ, sin(2θ) = 2 sin θ cos θ, cos(2θ) = cos²θ - sin²θ.",
        "source": "OpenStax Precalculus", "chapter": "Ch. 7 — Trigonometric Identities",
    },

    # ── Statistics ───────────────────────────────────────────────────────────
    {
        "id": "stat-mean",
        "text": "The mean (average) of a dataset is the sum of all values divided by the number of values: x̄ = (Σxᵢ) / n. The median is the middle value when sorted. The mode is the most frequent value. The range = max - min.",
        "source": "OpenStax Statistics", "chapter": "Ch. 2 — Descriptive Statistics",
    },
    {
        "id": "stat-std-dev",
        "text": "Standard deviation measures how spread out data is from the mean. Population std dev: σ = √(Σ(xᵢ - μ)² / N). Sample std dev: s = √(Σ(xᵢ - x̄)² / (n-1)). A small σ means data is clustered near the mean; large σ means it's spread out.",
        "source": "OpenStax Statistics", "chapter": "Ch. 2 — Descriptive Statistics",
    },
    {
        "id": "stat-probability",
        "text": "Probability of an event A: P(A) = (number of favorable outcomes) / (total number of outcomes). P(A) is between 0 and 1. P(not A) = 1 - P(A). For mutually exclusive events: P(A or B) = P(A) + P(B).",
        "source": "OpenStax Statistics", "chapter": "Ch. 3 — Probability",
    },
]


def get_collection():
    client = chromadb.PersistentClient(path=DB_PATH)
    return client.get_or_create_collection(
        name="math_knowledge",
        metadata={"hnsw:space": "cosine"},
    )


def seed_database():
    col = get_collection()
    existing = col.get()["ids"]
    to_add = [c for c in MATH_CHUNKS if c["id"] not in existing]
    if not to_add:
        return

    col.add(
        ids=[c["id"] for c in to_add],
        documents=[c["text"] for c in to_add],
        metadatas=[{"source": c["source"], "chapter": c["chapter"]} for c in to_add],
    )
    print(f"Seeded {len(to_add)} chunks into ChromaDB.")


def retrieve(query: str, n_results: int = 3) -> list[dict]:
    """Return the top n_results chunks most relevant to query."""
    col = get_collection()
    results = col.query(query_texts=[query], n_results=n_results)
    chunks = []
    for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
        chunks.append({"text": doc, "source": meta["source"], "chapter": meta["chapter"]})
    return chunks


if __name__ == "__main__":
    seed_database()
    print("Database ready.")
