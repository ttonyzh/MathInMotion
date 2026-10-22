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

EXPOSE 5005
CMD ["python", "-m", "python_backend.direct_manim_server"]
