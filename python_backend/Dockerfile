# Build context must be the repository root, e.g.:
#   docker build -f python_backend/Dockerfile -t mathinmotion-backend .
# (most hosting platforms let you set "Dockerfile path" separately from the
# build context root, which defaults to the repo root)

FROM python:3.11-slim

# Cairo + Pango: required by Manim to render text/shapes.
# ffmpeg: required by Manim to encode the final video.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY python_backend/requirements.txt ./python_backend/requirements.txt
RUN pip install --no-cache-dir -r python_backend/requirements.txt

COPY python_backend/ ./python_backend/

# chroma_db is git-ignored (regenerated, not hand-maintained - see
# python_backend/rag/math_db.py), so it never exists in a fresh clone.
# Run the scrapers here so the real knowledge base gets baked into this
# build's image layer instead of depending on whatever happens to be on
# the machine that ran `docker build`.
RUN cd python_backend/rag && python ingest_pauls_notes.py && python ingest_openstax.py

EXPOSE 5005
CMD ["python", "-m", "python_backend.direct_manim_server"]
