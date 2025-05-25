from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import uuid
import json
import base64
import re
from pathlib import Path

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Create a directory for storing generated media
MEDIA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'media')
os.makedirs(MEDIA_DIR, exist_ok=True)

def extract_equations_and_text(manim_code):
    """Extract equations and explanatory text from the Manim code"""
    equations = []
    explanations = []
    
    # Look for MathTex or Tex objects
    math_pattern = r'MathTex\(["\']([^"\']*)["\'](,\s*font_size=\d+)?\)'
    for match in re.finditer(math_pattern, manim_code):
        # Replace text representations with proper math symbols
        eq = match.group(1)
        # Fix common LaTeX symbols and ensure proper rendering
        eq = eq.replace('div', '\\div')
        eq = eq.replace('times', '\\times')
        
        # Greek letters
        eq = eq.replace('lambda', '\\lambda')
        eq = eq.replace('alpha', '\\alpha')
        eq = eq.replace('beta', '\\beta')
        eq = eq.replace('gamma', '\\gamma')
        eq = eq.replace('delta', '\\delta')
        eq = eq.replace('epsilon', '\\epsilon')
        eq = eq.replace('theta', '\\theta')
        eq = eq.replace('pi', '\\pi')
        eq = eq.replace('sigma', '\\sigma')
        eq = eq.replace('omega', '\\omega')
        
        # Ensure proper escaping for LaTeX commands
        # Replace any backslash followed by a letter with double backslash
        eq = re.sub(r'(?<!\\)\\([a-zA-Z]+)', r'\\\1', eq)
        equations.append(eq)
    
    # Look for Text objects that might be explanations
    text_pattern = r'Text\(["\']([^"\']*)["\']'
    for match in re.finditer(text_pattern, manim_code):
        explanations.append(match.group(1))
    
    # If we don't have equations, try to extract them from the code comments or strings
    if not equations:
        # Look for equations in comments or strings that look like equations
        eq_pattern = r'#\s*([^\n]*=\s*[^\n]*)'
        for match in re.finditer(eq_pattern, manim_code):
            potential_eq = match.group(1).strip()
            if "=" in potential_eq and not potential_eq.startswith("//") and not potential_eq.startswith("/*"):
                equations.append(potential_eq)
        
        # Also look for equations in string literals that aren't already captured
        string_eq_pattern = r'["\'](.*?=\s*.*?)["\']'
        for match in re.finditer(string_eq_pattern, manim_code):
            potential_eq = match.group(1).strip()
            if "=" in potential_eq and potential_eq not in equations:
                equations.append(potential_eq)
    
    # Try to generate explanations for each equation if we don't have enough
    if len(explanations) < len(equations):
        for i in range(len(explanations), len(equations)):
            eq = equations[i]
            
            # Generate an explanation based on the equation
            if i == 0:
                explanation = "We start with the initial equation."
            else:
                prev_eq = equations[i-1]
                
                # Try to determine what operation was performed
                if "=" in eq and "=" in prev_eq:
                    left_prev, right_prev = prev_eq.split("=", 1)
                    left_curr, right_curr = eq.split("=", 1)
                    
                    if left_prev != left_curr and right_prev != right_curr:
                        explanation = "We rearrange the equation to isolate the variable."
                    elif "+" in right_curr and "+" not in right_prev:
                        explanation = "We add terms on both sides of the equation."
                    elif "-" in right_curr and "-" not in right_prev:
                        explanation = "We subtract terms from both sides of the equation."
                    elif "*" in right_curr or "\\cdot" in right_curr or "\\times" in right_curr or "×" in right_curr:
                        explanation = "We multiply both sides of the equation."
                    elif "/" in right_curr or "\\div" in right_curr or "\\frac" in right_curr or "÷" in right_curr:
                        explanation = "We divide both sides of the equation."
                    else:
                        explanation = "We simplify the expression further."
                else:
                    explanation = f"We continue solving step {i+1}."
            
            explanations.append(explanation)
    
    return equations, explanations

def create_html_visualization(equations, explanations):
    """Create an HTML visualization with the given equations and explanations."""
    # Replace 'div' and 'times' with proper symbols and fix any character issues
    fixed_equations = []
    for eq in equations:
        # Replace mathematical operators with proper symbols
        eq = eq.replace('div', '÷').replace('times', '×')
        
        # Fix the lambda character issue - replace \A with \lambda
        eq = eq.replace('\\A', '\\lambda')
        
        # Also check for other potential character encoding issues
        eq = eq.replace('\\l', '\\lambda')
        
        # Fix other common Greek letters that might have encoding issues
        eq = eq.replace('\\a', '\\alpha')
        eq = eq.replace('\\b', '\\beta')
        eq = eq.replace('\\g', '\\gamma')
        eq = eq.replace('\\d', '\\delta')
        eq = eq.replace('\\e', '\\epsilon')
        eq = eq.replace('\\t', '\\theta')
        eq = eq.replace('\\p', '\\pi')
        eq = eq.replace('\\s', '\\sigma')
        eq = eq.replace('\\o', '\\omega')
        
        # Fix any raw unicode characters that might appear
        eq = eq.replace('λ', '\\lambda')
        eq = eq.replace('α', '\\alpha')
        eq = eq.replace('β', '\\beta')
        eq = eq.replace('γ', '\\gamma')
        eq = eq.replace('δ', '\\delta')
        eq = eq.replace('ε', '\\epsilon')
        eq = eq.replace('θ', '\\theta')
        eq = eq.replace('π', '\\pi')
        eq = eq.replace('σ', '\\sigma')
        eq = eq.replace('ω', '\\omega')
        
        fixed_equations.append(eq)
    
    equations = fixed_equations
    
    # Ensure we have explanations for each equation
    if len(explanations) < len(equations):
        # Fill in missing explanations
        for i in range(len(explanations), len(equations)):
            explanations.append(f"Step {i+1} in the solution process.")
    
    # If we have no explanations at all, create some generic ones
    if not explanations and equations:
        explanations = [f"Step {i+1} in the solution process." for i in range(len(equations))]
        
    # If we have only one equation, add a starting equation to show progression
    if len(equations) == 1:
        equations.insert(0, "\\text{Starting with the problem}")
        explanations.insert(0, "Let's begin solving this problem step by step.")
        
    # Ensure we have at least one equation and explanation
    if not equations:
        equations = ["\\text{No equations provided}"]  
    if not explanations:
        explanations = ["No explanation provided"]
        
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>STEM Problem Visualization</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #1e293b;
                color: #f8fafc;
            }
            .container {
                width: 100%;
                max-width: 800px;
                margin: 0 auto;
                padding: 30px;
                background-color: #0f172a;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                box-sizing: border-box;
            }
            h1, h2 {
                color: #f8fafc;
            }
            .video-container {
                position: relative;
                background-color: #0f172a;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                margin-bottom: 20px;
                aspect-ratio: 16 / 9;
                display: flex;
                flex-direction: column;
            }
            .video-screen {
                flex: 1;
                position: relative;
                background-image: 
                    linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
                background-size: 20px 20px;
                padding: 30px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                justify-content: center;
            }
            .slide {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                justify-content: center;
                padding: 30px;
                box-sizing: border-box;
                opacity: 0;
                transform: translateX(100%);
                transition: opacity 0.8s ease, transform 0.8s ease;
            }
            .slide.active {
                opacity: 1;
                transform: translateX(0);
                z-index: 2;
            }
            .slide.previous {
                opacity: 0;
                transform: translateX(-100%);
                z-index: 1;
            }
            .equation, .current-equation {
                font-size: 1.5em;
                margin: 15px 0;
                padding: 15px;
                background-color: rgba(30, 41, 59, 0.7);
                border-radius: 8px;
                text-align: center;
            }
            .current-equation {
                background-color: rgba(37, 99, 235, 0.3);
                border-left: 4px solid #60a5fa;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            }
            .previous-steps {
                margin-bottom: 20px;
                padding: 10px;
                background-color: rgba(15, 23, 42, 0.7);
                border-radius: 8px;
                border: 1px solid rgba(71, 85, 105, 0.3);
                max-height: 200px;
                overflow-y: auto;
            }
            .previous-step {
                margin-bottom: 12px;
                padding-bottom: 12px;
                border-bottom: 1px dashed rgba(71, 85, 105, 0.5);
            }
            .previous-step:last-child {
                border-bottom: none;
                margin-bottom: 0;
                padding-bottom: 0;
            }
            .step-label {
                font-size: 0.9em;
                color: #94a3b8;
                margin-bottom: 5px;
                font-weight: bold;
            }
            .step-label.highlight {
                color: #60a5fa;
                font-size: 1em;
            }
            .step-equation {
                font-size: 1.1em;
                color: #cbd5e1;
                padding: 5px;
            }
            .current-step {
                margin: 20px 0;
                padding: 15px;
                background-color: rgba(37, 99, 235, 0.2);
                border-radius: 8px;
                border-left: 4px solid #60a5fa;
            }
            code {
                background-color: rgba(15, 23, 42, 0.8);
                padding: 2px 5px;
                border-radius: 4px;
                font-family: monospace;
                color: #f8fafc;
            }
            .explanation, .step-explanation {
                margin: 15px 0;
                padding: 15px;
                background-color: rgba(30, 41, 59, 0.7);
                border-radius: 8px;
                font-size: 1.1em;
                line-height: 1.5;
            }
            .step-explanation {
                background-color: rgba(20, 184, 166, 0.2);
                border-left: 4px solid #2dd4bf;
            }
            .step-explanation strong {
                color: #2dd4bf;
                font-weight: bold;
            }
            .result-equation {
                font-size: 1.8em;
                margin: 20px 0;
                padding: 20px;
                background-color: rgba(37, 99, 235, 0.2);
                border-radius: 8px;
                text-align: center;
                border: 2px solid rgba(96, 165, 250, 0.5);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }
            .key-concepts {
                margin: 15px 0;
                padding: 15px;
                background-color: rgba(20, 184, 166, 0.1);
                border-radius: 8px;
                border-left: 4px solid #2dd4bf;
            }
            .key-concepts h3 {
                color: #2dd4bf;
                margin-top: 0;
                margin-bottom: 10px;
            }
            .key-concepts ul {
                margin: 0;
                padding-left: 20px;
            }
            .key-concepts li {
                margin: 5px 0;
                color: #e2e8f0;
            }
            .solution-progression {
                margin-bottom: 20px;
                padding: 15px;
                background-color: rgba(15, 23, 42, 0.7);
                border-radius: 8px;
                border: 1px solid rgba(71, 85, 105, 0.3);
                max-height: 200px;
                overflow-y: auto;
            }
            .previous-step {
                margin-bottom: 12px;
                padding-bottom: 12px;
                border-bottom: 1px dashed rgba(71, 85, 105, 0.5);
            }
            .previous-step:last-child {
                border-bottom: none;
                margin-bottom: 0;
                padding-bottom: 0;
            }
            .step-label {
                font-size: 0.9em;
                color: #94a3b8;
                margin-bottom: 5px;
                font-weight: bold;
            }
            .step-label.highlight {
                color: #60a5fa;
                font-size: 1em;
            }
            .step-equation {
                font-size: 1.1em;
                color: #cbd5e1;
                padding: 5px;
            }
            .current-step {
                margin: 20px 0;
                padding: 15px;
                background-color: rgba(37, 99, 235, 0.2);
                border-radius: 8px;
                border-left: 4px solid #60a5fa;
            }
            code {
                background-color: rgba(15, 23, 42, 0.8);
                padding: 2px 5px;
                border-radius: 4px;
                font-family: monospace;
                color: #f8fafc;
            }
            .step-title {
                color: #60a5fa;
                font-size: 1.2em;
                margin-bottom: 10px;
                font-weight: bold;
            }
            .video-controls {
                display: flex;
                flex-direction: column;
                background-color: #1e293b;
                padding: 10px;
                border-bottom-left-radius: 8px;
                border-bottom-right-radius: 8px;
            }
            .progress-container {
                width: 100%;
                height: 8px;
                background-color: #334155;
                border-radius: 4px;
                margin-bottom: 10px;
                overflow: hidden;
                cursor: pointer;
            }
            .progress-bar {
                height: 100%;
                width: 0%;
                background-color: #60a5fa;
                transition: width 0.3s ease;
            }
            .control-buttons {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 15px;
            }
            .control-button {
                background-color: #2563eb;
                color: white;
                border: none;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                cursor: pointer;
                font-size: 16px;
                transition: background-color 0.2s, transform 0.2s;
            }
            .control-button:hover {
                background-color: #1d4ed8;
                transform: scale(1.05);
            }
            .control-button.play-pause {
                width: 50px;
                height: 50px;
                font-size: 20px;
            }
            .time-display {
                font-size: 14px;
                color: #94a3b8;
                text-align: center;
                margin-top: 5px;
            }
            .chalk-effect {
                text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
            }
            .writing-animation {
                position: relative;
                display: inline-block;
            }
            .writing-animation::after {
                content: '';
                position: absolute;
                top: 0;
                right: 0;
                width: 100%;
                height: 100%;
                background-color: #0f172a;
                animation: typing 1.5s steps(30, end) forwards;
            }
            @keyframes typing {
                to { width: 0; }
            }
            .slide-indicator {
                position: absolute;
                bottom: 10px;
                left: 0;
                width: 100%;
                display: flex;
                justify-content: center;
                gap: 8px;
                z-index: 10;
            }
            .indicator-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background-color: #475569;
                transition: background-color 0.3s, transform 0.3s;
            }
            .indicator-dot.active {
                background-color: #60a5fa;
                transform: scale(1.2);
            }
            /* Fullscreen styles */
            .video-container:fullscreen {
                background-color: #0f172a;
                padding: 0;
                width: 100vw;
                height: 100vh;
                max-width: none;
            }
            .video-container:fullscreen .video-screen {
                height: calc(100vh - 70px);
                padding: 40px;
            }
            .video-container:fullscreen .video-controls {
                position: fixed;
                bottom: 0;
                left: 0;
                width: 100%;
                padding: 15px;
                background-color: rgba(15, 23, 42, 0.9);
                z-index: 100;
            }
            .video-container:fullscreen .slide {
                padding: 60px;
            }
            .video-container:-webkit-full-screen {
                background-color: #0f172a;
                padding: 0;
                width: 100vw;
                height: 100vh;
                max-width: none;
            }
            .video-container:-webkit-full-screen .video-screen {
                height: calc(100vh - 70px);
                padding: 40px;
            }
            .video-container:-webkit-full-screen .video-controls {
                position: fixed;
                bottom: 0;
                left: 0;
                width: 100%;
                padding: 15px;
                background-color: rgba(15, 23, 42, 0.9);
                z-index: 100;
            }
            .video-container:-webkit-full-screen .slide {
                padding: 60px;
            }
        </style>
        <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
        <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
        <script>
            document.addEventListener('DOMContentLoaded', function() {
                // Get all slides
                const slides = document.querySelectorAll('.slide');
                const totalSlides = slides.length;
                let currentSlide = 0;
                let isPlaying = false;
                let playbackInterval;
                let duration = 0;
                let startTime = 0;
                
                // Get control elements
                const progressBar = document.getElementById('progress-bar');
                const timeDisplay = document.getElementById('time-display');
                const playPauseBtn = document.getElementById('play-pause');
                const prevBtn = document.getElementById('prev');
                const nextBtn = document.getElementById('next');
                const fullscreenBtn = document.getElementById('fullscreen');
                const videoContainer = document.querySelector('.video-container');
                const indicatorDots = document.querySelectorAll('.indicator-dot');
                
                // Initialize first slide
                if (slides.length > 0) {
                    slides[0].classList.add('active');
                    indicatorDots[0].classList.add('active');
                }
                
                // Format time (seconds to MM:SS)
                function formatTime(seconds) {
                    const mins = Math.floor(seconds / 60);
                    const secs = Math.floor(seconds % 60);
                    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                }
                
                // Update time display
                function updateTimeDisplay() {
                    const currentTime = isPlaying ? (Date.now() - startTime) / 1000 + duration : duration;
                    const totalTime = totalSlides * 5; // Assuming 5 seconds per slide
                    timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(totalTime)}`;
                    
                    // Update progress bar
                    const progress = (currentTime / totalTime) * 100;
                    progressBar.style.width = `${Math.min(progress, 100)}%`;
                }
                
                // Go to specific slide
                function goToSlide(index) {
                    if (index < 0 || index >= totalSlides) return;
                    
                    // Remove classes from current slide
                    slides[currentSlide].classList.remove('active');
                    indicatorDots[currentSlide].classList.remove('active');
                    
                    // If going backward, add previous class to current slide
                    if (index < currentSlide) {
                        slides[currentSlide].classList.add('previous');
                    }
                    
                    // Remove previous class from all other slides
                    slides.forEach((slide, i) => {
                        if (i !== currentSlide) {
                            slide.classList.remove('previous');
                        }
                    });
                    
                    // Update current slide
                    currentSlide = index;
                    
                    // Add active class to new current slide
                    slides[currentSlide].classList.add('active');
                    indicatorDots[currentSlide].classList.add('active');
                    
                    // Update duration based on slide index
                    duration = currentSlide * 5; // 5 seconds per slide
                    
                    // Update display
                    updateTimeDisplay();
                }
                
                // Next slide function
                function nextSlide() {
                    if (currentSlide < totalSlides - 1) {
                        goToSlide(currentSlide + 1);
                        return true;
                    }
                    return false;
                }
                
                // Previous slide function
                function prevSlide() {
                    if (currentSlide > 0) {
                        goToSlide(currentSlide - 1);
                        return true;
                    }
                    return false;
                }
                
                // Play function
                function play() {
                    if (isPlaying) return;
                    
                    // If at the end, restart
                    if (currentSlide === totalSlides - 1) {
                        goToSlide(0);
                    }
                    
                    isPlaying = true;
                    startTime = Date.now();
                    playPauseBtn.innerHTML = '⏸';
                    
                    playbackInterval = setInterval(() => {
                        updateTimeDisplay();
                        
                        // Check if it's time to advance to next slide (every 5 seconds)
                        const elapsedTime = (Date.now() - startTime) / 1000;
                        if (elapsedTime >= 5) {
                            const hasMore = nextSlide();
                            if (!hasMore) {
                                pause();
                                playPauseBtn.innerHTML = '🔄';
                            } else {
                                // Reset timer for next slide
                                startTime = Date.now();
                            }
                        }
                    }, 100); // Update time display every 100ms
                }
                
                // Pause function
                function pause() {
                    if (!isPlaying) return;
                    
                    isPlaying = false;
                    clearInterval(playbackInterval);
                    duration += (Date.now() - startTime) / 1000;
                    playPauseBtn.innerHTML = '▶';
                    updateTimeDisplay();
                }
                
                // Add event listeners
                playPauseBtn.addEventListener('click', () => {
                    if (isPlaying) {
                        pause();
                    } else {
                        play();
                    }
                });
                
                prevBtn.addEventListener('click', () => {
                    pause();
                    prevSlide();
                });
                
                nextBtn.addEventListener('click', () => {
                    pause();
                    nextSlide();
                });
                
                // Click on progress bar to seek
                document.querySelector('.progress-container').addEventListener('click', (e) => {
                    const rect = e.target.getBoundingClientRect();
                    const pos = (e.clientX - rect.left) / rect.width;
                    const slideIndex = Math.min(Math.floor(pos * totalSlides), totalSlides - 1);
                    
                    pause();
                    goToSlide(slideIndex);
                });
                
                // Click on indicator dots to navigate
                indicatorDots.forEach((dot, index) => {
                    dot.addEventListener('click', () => {
                        pause();
                        goToSlide(index);
                    });
                });
                
                // Fullscreen functionality
                function toggleFullscreen() {
                    if (!document.fullscreenElement) {
                        // Enter fullscreen
                        if (videoContainer.requestFullscreen) {
                            videoContainer.requestFullscreen();
                        } else if (videoContainer.webkitRequestFullscreen) { /* Safari */
                            videoContainer.webkitRequestFullscreen();
                        } else if (videoContainer.msRequestFullscreen) { /* IE11 */
                            videoContainer.msRequestFullscreen();
                        }
                        fullscreenBtn.textContent = '⤢'; // Exit fullscreen icon
                    } else {
                        // Exit fullscreen
                        if (document.exitFullscreen) {
                            document.exitFullscreen();
                        } else if (document.webkitExitFullscreen) { /* Safari */
                            document.webkitExitFullscreen();
                        } else if (document.msExitFullscreen) { /* IE11 */
                            document.msExitFullscreen();
                        }
                        fullscreenBtn.textContent = '⤡'; // Enter fullscreen icon
                    }
                }
                
                // Add fullscreen button event listener
                fullscreenBtn.addEventListener('click', toggleFullscreen);
                
                // Listen for fullscreen change events
                document.addEventListener('fullscreenchange', () => {
                    if (document.fullscreenElement) {
                        fullscreenBtn.textContent = '⤢'; // Exit fullscreen icon
                    } else {
                        fullscreenBtn.textContent = '⤡'; // Enter fullscreen icon
                    }
                });
                
                // Also listen for webkit and MS fullscreen events for better browser support
                document.addEventListener('webkitfullscreenchange', () => {
                    if (document.webkitFullscreenElement) {
                        fullscreenBtn.textContent = '⤢';
                    } else {
                        fullscreenBtn.textContent = '⤡';
                    }
                });
                
                document.addEventListener('msfullscreenchange', () => {
                    if (document.msFullscreenElement) {
                        fullscreenBtn.textContent = '⤢';
                    } else {
                        fullscreenBtn.textContent = '⤡';
                    }
                });
                
                // Start playing automatically after a short delay
                setTimeout(play, 1000);
                
                // Update time display initially
                updateTimeDisplay();
            });
        </script>
    </head>
    <body>
        <h1>STEM Problem Solution</h1>
        <div class="video-container">
            <div class="video-screen">
    """
    
    # Create slides for each equation and explanation
    slides_html = ""
    slide_indicators = "<div class='slide-indicator'>\n"
    
    # Create a title slide
    slides_html += "<div class='slide'>\n"
    slides_html += "<div class='step-title writing-animation chalk-effect'>STEM Problem Solution</div>\n"
    slides_html += "<div class='equation chalk-effect'>Let's solve this step by step</div>\n"
    slides_html += "</div>\n"
    slide_indicators += "<div class='indicator-dot'></div>\n"
    
    # Create a progressive solution that builds with each step
    if equations:
        # Track all steps shown so far
        shown_steps = []
        
        for i, eq in enumerate(equations):
            slides_html += "<div class='slide'>\n"
            
            # Add step title with clear explanation of what we're doing
            if i == 0:
                slides_html += "<div class='step-title writing-animation chalk-effect'>Starting Point</div>\n"
            else:
                operation = ""  # Try to detect the operation
                if "=" in eq and "=" in equations[i-1]:
                    if "+" in eq and "+" not in equations[i-1]:
                        operation = "Adding"
                    elif "-" in eq and "-" not in equations[i-1]:
                        operation = "Subtracting"
                    elif "\\cdot" in eq or "\\times" in eq or "×" in eq:
                        operation = "Multiplying"
                    elif "\\div" in eq or "\\frac" in eq or "÷" in eq:
                        operation = "Dividing"
                    elif "^" in eq or "\\sqrt" in eq:
                        operation = "Applying exponents/roots"
                    elif "\\int" in eq:
                        operation = "Integrating"
                    elif "\\frac{d}{d" in eq:
                        operation = "Differentiating"
                    else:
                        operation = "Simplifying"
                
                slides_html += f"<div class='step-title writing-animation chalk-effect'>Step {i}: {operation}</div>\n"
            
            # Show all previous steps in sequence
            if shown_steps:
                slides_html += "<div class='solution-progression'>\n"
                for step_idx, step_eq in enumerate(shown_steps):
                    if step_idx == 0:
                        step_label = "Starting with:"
                    else:
                        step_label = f"Step {step_idx}:"
                    
                    slides_html += f"<div class='previous-step'>\n"
                    slides_html += f"<div class='step-label'>{step_label}</div>\n"
                    slides_html += f"<div class='step-equation'>\\({step_eq}\\)</div>\n"
                    slides_html += "</div>\n"
                slides_html += "</div>\n"
            
            # Show current step with highlight and clear indication
            slides_html += "<div class='current-step'>\n"
            slides_html += "<div class='step-label highlight'>Current Step:</div>\n"
            slides_html += f"<div class='current-equation chalk-effect'>\\({eq}\\)</div>\n"
            slides_html += "</div>\n"
            
            # Add detailed explanation for this specific step
            if i < len(explanations):
                slides_html += f"<div class='step-explanation'>\n"
                slides_html += f"<p><strong>What's happening:</strong> {explanations[i]}</p>\n"
                
                # Add hints about what to look for in this step
                if i > 0:
                    # Compare with previous equation to highlight changes
                    prev_eq = equations[i-1]
                    if "=" in eq and "=" in prev_eq:
                        left_prev, right_prev = prev_eq.split("=", 1)
                        left_curr, right_curr = eq.split("=", 1)
                        
                        if left_prev != left_curr:
                            slides_html += f"<p><strong>Notice:</strong> The left side changed from <code>{left_prev}</code> to <code>{left_curr}</code></p>\n"
                        if right_prev != right_curr:
                            slides_html += f"<p><strong>Notice:</strong> The right side changed from <code>{right_prev}</code> to <code>{right_curr}</code></p>\n"
                
                slides_html += "</div>\n"
            
            slides_html += "</div>\n"  # Close slide
            slide_indicators += "<div class='indicator-dot'></div>\n"
            
            # Add this step to our shown steps
            shown_steps.append(eq)
    
    # Add a final summary slide showing the complete solution and what was learned
    slides_html += "<div class='slide'>\n"
    slides_html += "<div class='step-title writing-animation chalk-effect'>What We Learned</div>\n"
    
    # Show the final equation as the result
    if equations:
        slides_html += "<div class='result-equation chalk-effect'>\n"
        slides_html += f"<p>Final Result: \\({equations[-1]}\\)</p>\n"
        slides_html += "</div>\n"
    
    # Add key concepts learned
    slides_html += "<div class='key-concepts'>\n"
    slides_html += "<h3>Key Concepts:</h3>\n"
    slides_html += "<ul>\n"
    
    # Extract key concepts from explanations
    concepts = set()
    for exp in explanations:
        # Look for mathematical terms and operations in the explanation
        terms = re.findall(r'\b(equation|formula|multiply|divide|add|subtract|factor|simplify|solve|calculate|integrate|differentiate|function)\b', 
                          exp.lower())
        concepts.update(terms)
    
    # If no specific terms found, use general concepts
    if not concepts:
        concepts = ["Problem solving", "Step-by-step approach", "Mathematical reasoning"]
    
    for concept in concepts:
        slides_html += f"<li>{concept.capitalize()}</li>\n"
    
    slides_html += "</ul>\n"
    slides_html += "</div>\n"
    
    # Add any remaining explanations
    if len(explanations) > len(equations):
        for i in range(len(equations), len(explanations)):
            slides_html += f"<div class='explanation'>\n"
            slides_html += f"<p>{explanations[i]}</p>\n"
            slides_html += "</div>\n"
    
    slides_html += "</div>\n"
    slide_indicators += "<div class='indicator-dot'></div>\n"
    
    # Close slide indicators
    slide_indicators += "</div>\n"
    
    # Add slides to the video screen
    html += slides_html
    html += slide_indicators
    
    # Close video screen and add controls
    html += "</div>\n"  # Close video-screen
    
    # Add video controls
    html += """<div class='video-controls'>
        <div class='progress-container'>
            <div class='progress-bar' id='progress-bar'></div>
        </div>
        <div class='control-buttons'>
            <button class='control-button' id='prev'>⏮</button>
            <button class='control-button play-pause' id='play-pause'>▶</button>
            <button class='control-button' id='next'>⏭</button>
            <button class='control-button' id='fullscreen'>⤡</button>
        </div>
        <div class='time-display' id='time-display'>00:00 / 00:00</div>
    </div>
    """
    
    # Close HTML
    html += """
        </div> <!-- Close video-container -->
    </body>
    </html>
    """
    
    return html

@app.route('/render-manim', methods=['POST'])
def render_manim():
    try:
        data = request.json
        manim_code = data.get('manimCode')
        
        if not manim_code:
            return jsonify({'error': 'No code provided'}), 400
        
        # Create a unique ID for this rendering
        render_id = str(uuid.uuid4())
        
        # Create a directory for this render
        render_dir = os.path.join(MEDIA_DIR, render_id)
        os.makedirs(render_dir, exist_ok=True)
        
        # Extract equations and explanations from the code
        equations, explanations = extract_equations_and_text(manim_code)
        
        # Create an HTML visualization
        html_content = create_html_visualization(equations, explanations)
        
        # Save the HTML
        html_path = os.path.join(render_dir, 'visualization.html')
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        # Convert the HTML to base64
        html_base64 = base64.b64encode(html_content.encode('utf-8')).decode('utf-8')
        
        return jsonify({
            'success': True,
            'renderId': render_id,
            'videoBase64': html_base64,
            'contentType': 'text/html'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/media/<render_id>/<filename>', methods=['GET'])
def get_media(render_id, filename):
    """Serve generated media files"""
    media_path = os.path.join(MEDIA_DIR, render_id, filename)
    return send_file(media_path)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)
