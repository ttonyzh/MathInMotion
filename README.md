# Tutor AI - Visual STEM Problem Solver

Tutor AI is an educational application that helps students understand and solve STEM problems through visual explanations. The application integrates Azure OpenAI for problem analysis and generates visual explanations of mathematical and scientific concepts.

## Features

- **File Upload**: Upload images or PDFs containing STEM problems
- **Azure OpenAI Integration**: Analyze problems and generate step-by-step solutions
- **Visual Explanations**: Create visual representations of solutions with mathematical notation
- **Responsive UI**: Clean, intuitive interface for both desktop and mobile users

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: 
  - Next.js API routes for the main application
  - Python Flask server for visualization rendering
- **AI**: Azure OpenAI (GPT-4 Vision)
- **Visualization**: HTML/CSS with MathJax for equations

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- Python 3.8 or later
- Azure OpenAI API key and endpoint

### Environment Setup

Create a `.env.local` file in the root directory with the following variables:

```
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name
AZURE_OPENAI_API_VERSION=2023-05-15
```

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Set up the Python backend:

```bash
cd python_backend
chmod +x setup.sh
./setup.sh
```

### Running the Application

Use the start script to run both the Next.js frontend and Python backend:

```bash
./start.sh
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.
