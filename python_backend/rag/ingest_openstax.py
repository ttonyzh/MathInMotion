"""
Scrapes real OpenStax textbook sections and loads content into ChromaDB.
Run once: python ingest_openstax.py

Every URL below was individually verified (fetched and content-checked)
to actually cover the topic it's labeled with, before being added here.
"""

import requests
import re
import time
import hashlib
from math_db import get_collection

HEADERS = {"User-Agent": "MathInMotion/1.0 (educational project)"}

def _intalg(slug, title):
    return (f"https://openstax.org/books/intermediate-algebra-2e/pages/{slug}",
            "OpenStax Intermediate Algebra 2e", title)


def _calc(slug, title):
    return (f"https://openstax.org/books/calculus-volume-1/pages/{slug}",
            "OpenStax Calculus Volume 1", title)


def _prealg(slug, title):
    return (f"https://openstax.org/books/prealgebra-2e/pages/{slug}",
            "OpenStax Prealgebra 2e", title)


def _precalc(slug, title):
    return (f"https://openstax.org/books/precalculus-2e/pages/{slug}",
            "OpenStax Precalculus 2e", title)


def _stats(slug, title):
    return (f"https://openstax.org/books/introductory-statistics-2e/pages/{slug}",
            "OpenStax Introductory Statistics 2e", title)


PAGES = [
    # ── Intermediate Algebra 2e — Ch. 2: Solving Linear Equations & Inequalities (all 7 sections)
    _intalg("2-1-use-a-general-strategy-to-solve-linear-equations", "Ch. 2.1 — General Strategy to Solve Linear Equations"),
    _intalg("2-2-use-a-problem-solving-strategy", "Ch. 2.2 — Problem Solving Strategy"),
    _intalg("2-3-solve-a-formula-for-a-specific-variable", "Ch. 2.3 — Solve a Formula for a Specific Variable"),
    _intalg("2-4-solve-mixture-and-uniform-motion-applications", "Ch. 2.4 — Mixture and Uniform Motion Applications"),
    _intalg("2-5-solve-linear-inequalities", "Ch. 2.5 — Solve Linear Inequalities"),
    _intalg("2-6-solve-compound-inequalities", "Ch. 2.6 — Solve Compound Inequalities"),
    _intalg("2-7-solve-absolute-value-inequalities", "Ch. 2.7 — Solve Absolute Value Inequalities"),

    # ── Intermediate Algebra 2e — Ch. 4: Systems of Linear Equations (all 7 sections)
    _intalg("4-1-solve-systems-of-linear-equations-with-two-variables", "Ch. 4.1 — Systems of Linear Equations (Two Variables)"),
    _intalg("4-2-solve-applications-with-systems-of-equations", "Ch. 4.2 — Applications with Systems of Equations"),
    _intalg("4-3-solve-mixture-applications-with-systems-of-equations", "Ch. 4.3 — Mixture Applications with Systems of Equations"),
    _intalg("4-4-solve-systems-of-equations-with-three-variables", "Ch. 4.4 — Systems of Equations with Three Variables"),
    _intalg("4-5-solve-systems-of-equations-using-matrices", "Ch. 4.5 — Systems of Equations Using Matrices"),
    _intalg("4-6-solve-systems-of-equations-using-determinants", "Ch. 4.6 — Systems of Equations Using Determinants"),
    _intalg("4-7-graphing-systems-of-linear-inequalities", "Ch. 4.7 — Graphing Systems of Linear Inequalities"),

    # ── Intermediate Algebra 2e — Ch. 5: Polynomials (all 4 sections)
    _intalg("5-1-add-and-subtract-polynomials", "Ch. 5.1 — Add and Subtract Polynomials"),
    _intalg("5-2-properties-of-exponents-and-scientific-notation", "Ch. 5.2 — Properties of Exponents"),
    _intalg("5-3-multiply-polynomials", "Ch. 5.3 — Multiply Polynomials"),
    _intalg("5-4-dividing-polynomials", "Ch. 5.4 — Dividing Polynomials"),

    # ── Intermediate Algebra 2e — Ch. 9: Quadratic Equations (all 8 sections)
    _intalg("9-1-solve-quadratic-equations-using-the-square-root-property", "Ch. 9.1 — Square Root Property"),
    _intalg("9-2-solve-quadratic-equations-by-completing-the-square", "Ch. 9.2 — Completing the Square"),
    _intalg("9-3-solve-quadratic-equations-using-the-quadratic-formula", "Ch. 9.3 — Quadratic Formula"),
    _intalg("9-4-solve-equations-in-quadratic-form", "Ch. 9.4 — Equations in Quadratic Form"),
    _intalg("9-5-solve-applications-of-quadratic-equations", "Ch. 9.5 — Applications of Quadratic Equations"),
    _intalg("9-6-graph-quadratic-functions-using-properties", "Ch. 9.6 — Graph Quadratic Functions Using Properties"),
    _intalg("9-7-graph-quadratic-functions-using-transformations", "Ch. 9.7 — Graph Quadratic Functions Using Transformations"),
    _intalg("9-8-solve-quadratic-inequalities", "Ch. 9.8 — Solve Quadratic Inequalities"),

    # ── Intermediate Algebra 2e — Ch. 10: Exponential & Logarithmic Functions (all 5 sections)
    _intalg("10-1-finding-composite-and-inverse-functions", "Ch. 10.1 — Composite and Inverse Functions"),
    _intalg("10-2-evaluate-and-graph-exponential-functions", "Ch. 10.2 — Exponential Functions"),
    _intalg("10-3-evaluate-and-graph-logarithmic-functions", "Ch. 10.3 — Logarithmic Functions"),
    _intalg("10-4-use-the-properties-of-logarithms", "Ch. 10.4 — Properties of Logarithms"),
    _intalg("10-5-solve-exponential-and-logarithmic-equations", "Ch. 10.5 — Solve Exponential and Logarithmic Equations"),

    # ── Calculus Volume 1 — Ch. 2: Limits (all 5 sections)
    _calc("2-1-a-preview-of-calculus", "Ch. 2.1 — A Preview of Calculus"),
    _calc("2-2-the-limit-of-a-function", "Ch. 2.2 — The Limit of a Function"),
    _calc("2-3-the-limit-laws", "Ch. 2.3 — The Limit Laws"),
    _calc("2-4-continuity", "Ch. 2.4 — Continuity"),
    _calc("2-5-the-precise-definition-of-a-limit", "Ch. 2.5 — The Precise Definition of a Limit"),

    # ── Calculus Volume 1 — Ch. 3: Derivatives (all 9 sections)
    _calc("3-1-defining-the-derivative", "Ch. 3.1 — Defining the Derivative"),
    _calc("3-2-the-derivative-as-a-function", "Ch. 3.2 — The Derivative as a Function"),
    _calc("3-3-differentiation-rules", "Ch. 3.3 — Differentiation Rules"),
    _calc("3-4-derivatives-as-rates-of-change", "Ch. 3.4 — Derivatives as Rates of Change"),
    _calc("3-5-derivatives-of-trigonometric-functions", "Ch. 3.5 — Derivatives of Trigonometric Functions"),
    _calc("3-6-the-chain-rule", "Ch. 3.6 — The Chain Rule"),
    _calc("3-7-derivatives-of-inverse-functions", "Ch. 3.7 — Derivatives of Inverse Functions"),
    _calc("3-8-implicit-differentiation", "Ch. 3.8 — Implicit Differentiation"),
    _calc("3-9-derivatives-of-exponential-and-logarithmic-functions", "Ch. 3.9 — Derivatives of Exponential and Logarithmic Functions"),

    # ── Calculus Volume 1 — Ch. 4: Applications of Derivatives (all 10 sections)
    _calc("4-1-related-rates", "Ch. 4.1 — Related Rates"),
    _calc("4-2-linear-approximations-and-differentials", "Ch. 4.2 — Linear Approximations and Differentials"),
    _calc("4-3-maxima-and-minima", "Ch. 4.3 — Maxima and Minima"),
    _calc("4-4-the-mean-value-theorem", "Ch. 4.4 — The Mean Value Theorem"),
    _calc("4-5-derivatives-and-the-shape-of-a-graph", "Ch. 4.5 — Derivatives and the Shape of a Graph"),
    _calc("4-6-limits-at-infinity-and-asymptotes", "Ch. 4.6 — Limits at Infinity and Asymptotes"),
    _calc("4-7-applied-optimization-problems", "Ch. 4.7 — Applied Optimization Problems"),
    _calc("4-8-lhopitals-rule", "Ch. 4.8 — L'Hopital's Rule"),
    _calc("4-9-newtons-method", "Ch. 4.9 — Newton's Method"),
    _calc("4-10-antiderivatives", "Ch. 4.10 — Antiderivatives"),

    # ── Calculus Volume 1 — Ch. 5: Integration (all 7 sections)
    _calc("5-1-approximating-areas", "Ch. 5.1 — Approximating Areas"),
    _calc("5-2-the-definite-integral", "Ch. 5.2 — The Definite Integral"),
    _calc("5-3-the-fundamental-theorem-of-calculus", "Ch. 5.3 — The Fundamental Theorem of Calculus"),
    _calc("5-4-integration-formulas-and-the-net-change-theorem", "Ch. 5.4 — Integration Formulas and the Net Change Theorem"),
    _calc("5-5-substitution", "Ch. 5.5 — Substitution"),
    _calc("5-6-integrals-involving-exponential-and-logarithmic-functions", "Ch. 5.6 — Integrals Involving Exponential and Logarithmic Functions"),
    _calc("5-7-integrals-resulting-in-inverse-trigonometric-functions", "Ch. 5.7 — Integrals Resulting in Inverse Trigonometric Functions"),

    # ── Prealgebra 2e — Ch. 9: Math Models and Geometry (all 7 sections)
    _prealg("9-1-use-a-problem-solving-strategy", "Ch. 9.1 — Problem Solving Strategy"),
    _prealg("9-2-solve-money-applications", "Ch. 9.2 — Money Applications"),
    _prealg("9-3-use-properties-of-angles-triangles-and-the-pythagorean-theorem", "Ch. 9.3 — Angles, Triangles, and the Pythagorean Theorem"),
    _prealg("9-4-use-properties-of-rectangles-triangles-and-trapezoids", "Ch. 9.4 — Rectangles, Triangles, and Trapezoids"),
    _prealg("9-5-solve-geometry-applications-circles-and-irregular-figures", "Ch. 9.5 — Circles and Irregular Figures"),
    _prealg("9-6-solve-geometry-applications-volume-and-surface-area", "Ch. 9.6 — Volume and Surface Area"),
    _prealg("9-7-solve-a-formula-for-a-specific-variable", "Ch. 9.7 — Solve a Formula for a Specific Variable"),

    # ── Precalculus 2e — Ch. 5: Trigonometric Functions (all 4 sections)
    _precalc("5-1-angles", "Ch. 5.1 — Angles"),
    _precalc("5-2-unit-circle-sine-and-cosine-functions", "Ch. 5.2 — Unit Circle: Sine and Cosine Functions"),
    _precalc("5-3-the-other-trigonometric-functions", "Ch. 5.3 — The Other Trigonometric Functions"),
    _precalc("5-4-right-triangle-trigonometry", "Ch. 5.4 — Right Triangle Trigonometry"),

    # ── Precalculus 2e — Ch. 7: Trigonometric Identities and Equations (all 6 sections)
    _precalc("7-1-simplifying-and-verifying-trigonometric-identities", "Ch. 7.1 — Trigonometric Identities"),
    _precalc("7-2-sum-and-difference-identities", "Ch. 7.2 — Sum and Difference Identities"),
    _precalc("7-3-double-angle-half-angle-and-reduction-formulas", "Ch. 7.3 — Double-Angle, Half-Angle, and Reduction Formulas"),
    _precalc("7-4-sum-to-product-and-product-to-sum-formulas", "Ch. 7.4 — Sum-to-Product and Product-to-Sum Formulas"),
    _precalc("7-5-solving-trigonometric-equations", "Ch. 7.5 — Solving Trigonometric Equations"),
    _precalc("7-6-modeling-with-trigonometric-functions", "Ch. 7.6 — Modeling with Trigonometric Functions"),

    # ── Introductory Statistics 2e — Ch. 2: Descriptive Statistics (6 of 7 sections; skips the hands-on lab section)
    _stats("2-1-stem-and-leaf-graphs-stemplots-line-graphs-and-bar-graphs", "Ch. 2.1 — Stem-and-Leaf Graphs, Line Graphs, Bar Graphs"),
    _stats("2-2-histograms-frequency-polygons-and-time-series-graphs", "Ch. 2.2 — Histograms, Frequency Polygons, Time Series Graphs"),
    _stats("2-3-measures-of-the-location-of-the-data", "Ch. 2.3 — Measures of the Location of the Data"),
    _stats("2-4-box-plots", "Ch. 2.4 — Box Plots"),
    _stats("2-5-measures-of-the-center-of-the-data", "Ch. 2.5 — Measures of the Center of the Data"),
    _stats("2-6-skewness-and-the-mean-median-and-mode", "Ch. 2.6 — Skewness and the Mean, Median, and Mode"),
    _stats("2-7-measures-of-the-spread-of-the-data", "Ch. 2.7 — Measures of the Spread of the Data"),

    # ── Introductory Statistics 2e — Ch. 3: Probability Topics (all 5 sections)
    _stats("3-1-terminology", "Ch. 3.1 — Terminology"),
    _stats("3-2-independent-and-mutually-exclusive-events", "Ch. 3.2 — Independent and Mutually Exclusive Events"),
    _stats("3-3-two-basic-rules-of-probability", "Ch. 3.3 — Two Basic Rules of Probability"),
    _stats("3-4-contingency-tables", "Ch. 3.4 — Contingency Tables"),
    _stats("3-5-tree-and-venn-diagrams", "Ch. 3.5 — Tree and Venn Diagrams"),
]


def extract_main_content_from_html(html: str) -> str:
    """Extract section text from an OpenStax page.
    Real content lives inside <main id="main-content">...</main>;
    everything outside that (nav, a duplicated hydration-data blob, footer)
    is discarded.
    """
    open_tag = re.search(r'<main\b[^>]*>', html)
    end = html.find('</main>')
    if not open_tag or end == -1 or end <= open_tag.end():
        return ""
    html = html[open_tag.end():end]

    # Strip scripts and styles
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)

    # Preserve paragraph/heading breaks
    html = re.sub(r'<h[1-6][^>]*>', '\n\n', html, flags=re.IGNORECASE)
    html = re.sub(r'</h[1-6]>', '\n', html, flags=re.IGNORECASE)
    html = re.sub(r'</p>|</div>|</li>|<br\s*/?>', '\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<li[^>]*>', '• ', html, flags=re.IGNORECASE)

    # Strip remaining tags (this also strips MathML markup around formulas,
    # leaving the plain-text/alt-text representation of the math)
    html = re.sub(r'<[^>]+>', '', html)

    # Unescape HTML entities
    html = re.sub(r'&amp;', '&', html)
    html = re.sub(r'&lt;', '<', html)
    html = re.sub(r'&gt;', '>', html)
    html = re.sub(r'&nbsp;', ' ', html)
    html = re.sub(r'&#\d+;', '', html)

    # Normalize whitespace
    html = re.sub(r'[ \t]+', ' ', html)
    html = re.sub(r'\n{3,}', '\n\n', html)

    # Cut off trailing summary/exercise sections if present on the page
    for footer in ["Key Concepts", "Key Equations", "Section Exercises",
                   "Practice Makes Perfect", "Writing Exercises", "Glossary"]:
        idx = html.rfind(footer)
        if idx != -1:
            html = html[:idx]

    return html.strip()


def chunk_text(text: str, chunk_size: int = 600, overlap: int = 80) -> list[str]:
    """Split text into overlapping chunks on paragraph boundaries."""
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    chunks, current = [], ""
    for para in paragraphs:
        if len(current) + len(para) < chunk_size:
            current += (" " if current else "") + para
        else:
            if current:
                chunks.append(current)
            words = current.split()
            overlap_text = " ".join(words[-overlap // 6:]) if words else ""
            current = (overlap_text + " " + para).strip() if overlap_text else para
    if current:
        chunks.append(current)
    return [c for c in chunks if len(c) > 80]


def ingest():
    col = get_collection()
    existing_ids = set(col.get()["ids"])
    total_added = 0

    for url, source, chapter in PAGES:
        print(f"  Fetching: {chapter}...")
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            resp.raise_for_status()
            resp.encoding = 'utf-8'  # server omits charset; without this, requests
                                      # falls back to ISO-8859-1 and mangles unicode
        except Exception as e:
            print(f"    SKIP — {e}")
            time.sleep(1)
            continue

        text = extract_main_content_from_html(resp.text)
        chunks = chunk_text(text)

        ids, docs, metas = [], [], []
        for i, chunk in enumerate(chunks):
            chunk_id = f"openstax-{hashlib.md5((url + str(i)).encode()).hexdigest()[:12]}"
            if chunk_id in existing_ids:
                continue
            ids.append(chunk_id)
            docs.append(chunk)
            metas.append({"source": source, "chapter": chapter, "url": url})

        if ids:
            col.add(ids=ids, documents=docs, metadatas=metas)
            total_added += len(ids)
            print(f"    Added {len(ids)} chunks")
        else:
            print(f"    Already up to date")

        time.sleep(0.5)  # polite delay

    print(f"\nDone. Added {total_added} new chunks total.")


if __name__ == "__main__":
    ingest()
