"""
RAG knowledge base for MathInMotion.

The knowledge base is populated by the ingest scripts in this directory
(ingest_pauls_notes.py, ingest_openstax.py), which scrape real textbook/
reference content and load it into ChromaDB — nothing here is hand-written.
This module just provides shared access to that collection: get_collection()
for the ingest scripts to write to, and retrieve() for the Flask server to
query at request time.
"""

import chromadb
from pathlib import Path

DB_PATH = str(Path(__file__).parent / "chroma_db")


def get_collection():
    client = chromadb.PersistentClient(path=DB_PATH)
    return client.get_or_create_collection(
        name="math_knowledge",
        metadata={"hnsw:space": "cosine"},
    )


# Cosine distance cutoff (0 = identical, 2 = unrelated) above which a chunk is
# treated as "not actually relevant" rather than forced in just to fill n_results.
# Calibrated from real queries: genuinely relevant chunks scored ~0.42-0.51,
# genuinely irrelevant ones scored ~0.63-0.68 for topics missing from the KB.
MAX_RELEVANT_DISTANCE = 0.55


def retrieve(query: str, n_results: int = 3) -> list[dict]:
    """Return up to n_results chunks relevant to query.

    May return fewer than n_results (including zero) if the knowledge base
    doesn't actually have anything close enough to the query — this is
    intentional: a forced "closest available" result that isn't actually
    relevant is worse than no citation at all.
    """
    col = get_collection()
    results = col.query(query_texts=[query], n_results=n_results, include=["documents", "metadatas", "distances"])
    chunks = []
    for doc, meta, dist in zip(results["documents"][0], results["metadatas"][0], results["distances"][0]):
        if dist > MAX_RELEVANT_DISTANCE:
            continue
        chunks.append({"text": doc, "source": meta["source"], "chapter": meta["chapter"], "url": meta.get("url")})
    return chunks
