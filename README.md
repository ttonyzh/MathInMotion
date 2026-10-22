# MathInMotion - Visual STEM Problem Solver

MathInMotion helps students understand and solve STEM problems through animated visual explanations. Upload an image/PDF or type a problem, and the app generates a step-by-step animated video using Manim.

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes + Python Flask server
- **AI**: Azure OpenAI + Azure Cognitive Services Speech
- **Animation**: Manim (Community Edition)

## Prerequisites

Install the following before getting started:

1. **Node.js** (v18 or later) — https://nodejs.org
2. **Python 3.11** — https://www.python.org/downloads/
3. **Cairo** (required by Manim for rendering):
   - macOS: `brew install cairo pkg-config`
   - Ubuntu/Debian: `sudo apt install libcairo2-dev pkg-config`
   - Windows: install via GTK — see https://www.manim.community/doc/stable/installation/windows.html
4. **Azure OpenAI** — create a resource at https://portal.azure.com and deploy a GPT-4o or GPT-4 model
5. **Azure Speech** — create a Speech resource at https://portal.azure.com (Free F0 tier is sufficient)

> **You must supply your own API keys.** This project does not include any credentials.

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/ttonyzh/tutor_AI
cd tutor_AI
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install Python backend dependencies

```bash
pip install -r python_backend/requirements.txt
```

### 4. Set up environment variables

Create a `.env.local` file in the **root directory** for the Next.js frontend:

```
AZURE_OPENAI_API_KEY=your-azure-openai-key
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name
AZURE_OPENAI_API_VERSION=2025-01-01-preview
```

Create a `.env` file in the **`python_backend/` directory** for the Flask server:

```
AZURE_SPEECH_KEY=your-azure-speech-key
AZURE_SPEECH_REGION=eastus
```

> Replace `eastus` with whichever Azure region your Speech resource is in.

### 5. Seed the RAG knowledge base

The vector database isn't committed to the repo (it's regenerated from source, not hand-maintained). Run these once from `python_backend/rag/`:

```bash
python ingest_pauls_notes.py
python ingest_openstax.py
```

This scrapes real content from Paul's Online Math Notes and OpenStax textbooks and loads it into a local ChromaDB store at `python_backend/rag/chroma_db/`. Takes a minute or two; both scripts are safe to re-run (they skip anything already ingested).

## Running the App

You need two terminals running simultaneously:

**Terminal 1 — Python Flask server (port 5005):**
```bash
python -m python_backend.direct_manim_server
```

**Terminal 2 — Next.js frontend (port 3000):**
```bash
npm run dev
```

Then open http://localhost:3000 in your browser.

## Usage

1. Type a math/STEM problem in the text box, or upload a PDF/image
2. Click **Solve & Animate**
3. The app calls Azure OpenAI to generate a solution and Manim animation code
4. The Flask server renders the animation into an MP4 video
5. Watch the step-by-step animated explanation in the browser
