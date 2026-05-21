"""
Scrapes Paul's Online Math Notes and loads content into ChromaDB.
Run once: python ingest_pauls_notes.py
"""

import requests
import re
import time
import hashlib
from math_db import get_collection

HEADERS = {"User-Agent": "MathInMotion/1.0 (educational project)"}

PAGES = [
    # ── Algebra ──────────────────────────────────────────────────────────────
    ("https://tutorial.math.lamar.edu/Classes/Alg/SolveLinearEqns.aspx",        "Paul's Online Math Notes — Algebra", "Linear Equations"),
    ("https://tutorial.math.lamar.edu/Classes/Alg/SolveLinearInequalities.aspx", "Paul's Online Math Notes — Algebra", "Linear Inequalities"),
    ("https://tutorial.math.lamar.edu/Classes/Alg/SolveQuadraticEqnsI.aspx",    "Paul's Online Math Notes — Algebra", "Quadratic Equations (Factoring)"),
    ("https://tutorial.math.lamar.edu/Classes/Alg/SolveQuadraticEqnsII.aspx",   "Paul's Online Math Notes — Algebra", "Quadratic Equations (Formula)"),
    ("https://tutorial.math.lamar.edu/Classes/Alg/SystemsTwoVrble.aspx",        "Paul's Online Math Notes — Algebra", "Systems of Equations"),
    ("https://tutorial.math.lamar.edu/Classes/Alg/IntegerExponents.aspx",       "Paul's Online Math Notes — Algebra", "Exponents"),
    ("https://tutorial.math.lamar.edu/Classes/Alg/Factoring.aspx",              "Paul's Online Math Notes — Algebra", "Factoring Polynomials"),
    ("https://tutorial.math.lamar.edu/Classes/Alg/RationalExpressions.aspx",    "Paul's Online Math Notes — Algebra", "Rational Expressions"),

    # ── Calculus I ───────────────────────────────────────────────────────────
    ("https://tutorial.math.lamar.edu/Classes/CalcI/TheLimit.aspx",             "Paul's Online Math Notes — Calculus I", "Limits"),
    ("https://tutorial.math.lamar.edu/Classes/CalcI/LimitProperties.aspx",      "Paul's Online Math Notes — Calculus I", "Limit Properties"),
    ("https://tutorial.math.lamar.edu/Classes/CalcI/DefnOfDerivative.aspx",     "Paul's Online Math Notes — Calculus I", "Definition of the Derivative"),
    ("https://tutorial.math.lamar.edu/Classes/CalcI/DiffFormulas.aspx",         "Paul's Online Math Notes — Calculus I", "Differentiation Formulas"),
    ("https://tutorial.math.lamar.edu/Classes/CalcI/ProductQuotientRule.aspx",  "Paul's Online Math Notes — Calculus I", "Product & Quotient Rule"),
    ("https://tutorial.math.lamar.edu/Classes/CalcI/ChainRule.aspx",            "Paul's Online Math Notes — Calculus I", "Chain Rule"),
    ("https://tutorial.math.lamar.edu/Classes/CalcI/DerivativesofTrigFunctions.aspx", "Paul's Online Math Notes — Calculus I", "Derivatives of Trig Functions"),
    ("https://tutorial.math.lamar.edu/Classes/CalcI/ComputingIndefiniteIntegrals.aspx", "Paul's Online Math Notes — Calculus I", "Indefinite Integrals"),
    ("https://tutorial.math.lamar.edu/Classes/CalcI/DefnOfDefiniteIntegral.aspx", "Paul's Online Math Notes — Calculus I", "Definite Integrals"),
    ("https://tutorial.math.lamar.edu/Classes/CalcI/FundamentalTheoremOfCalculus.aspx", "Paul's Online Math Notes — Calculus I", "Fundamental Theorem of Calculus"),

    # ── Algebra & Trig Review ────────────────────────────────────────────────
    ("https://tutorial.math.lamar.edu/Extras/AlgebraTrigReview/TrigFunctions.aspx", "Paul's Online Math Notes — Trig Review", "Trig Functions"),
    ("https://tutorial.math.lamar.edu/Extras/AlgebraTrigReview/TrigEquations.aspx", "Paul's Online Math Notes — Trig Review", "Trig Equations"),
    ("https://tutorial.math.lamar.edu/Extras/AlgebraTrigReview/TrigSubstitutions.aspx", "Paul's Online Math Notes — Trig Review", "Trig Identities"),
]


def extract_main_content_from_html(html: str) -> str:
    """Extract lesson text from Paul's Notes HTML.
    Content lives after </form> in plain paragraph tags with LaTeX in \\[...\\] notation.
    """
    # Content starts after the ASP.NET form block
    form_end = html.find('</form>')
    if form_end != -1:
        html = html[form_end + len('</form>'):]

    # Strip scripts and styles
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)

    # Preserve paragraph/heading breaks
    html = re.sub(r'<h[1-6][^>]*>', '\n\n', html, flags=re.IGNORECASE)
    html = re.sub(r'</h[1-6]>', '\n', html, flags=re.IGNORECASE)
    html = re.sub(r'</p>|</div>|</li>|<br\s*/?>', '\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<li[^>]*>', '• ', html, flags=re.IGNORECASE)

    # Strip remaining tags
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

    # Cut off footer / practice problems section
    for footer in ["Practice Problems", "© Paul Dawkins", "Section Notes"]:
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
            # Start next chunk with overlap from previous
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
        except Exception as e:
            print(f"    SKIP — {e}")
            time.sleep(1)
            continue

        text = extract_main_content_from_html(resp.text)
        chunks = chunk_text(text)

        ids, docs, metas = [], [], []
        for i, chunk in enumerate(chunks):
            chunk_id = f"pauls-{hashlib.md5((url + str(i)).encode()).hexdigest()[:12]}"
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
