import { NextRequest, NextResponse } from 'next/server';

// Allow this route up to 120 seconds (reasoning models can be slow)
export const maxDuration = 120;

// Define types for better type safety

interface Citation {
  source: string;
  chapter: string;
  url?: string;
}

interface ProcessResponse {
  success: boolean;
  solution: string;
  manimCode: string;
  citations?: Citation[];
  error?: string;
  suggestion?: string;
  debugInfo?: {
    error?: string;
    stack?: string;
    timestamp?: string;
  };
}

async function fetchRAGContext(query: string): Promise<{ context: string; citations: Citation[] }> {
  try {
    const backendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:5005';
    const res = await fetch(`${backendUrl}/rag-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { context: '', citations: [] };
    const data = await res.json();
    const chunks: { text: string; source: string; chapter: string; url?: string }[] = data.chunks || [];
    const context = chunks
      .map(c => `${c.text}\n(Source: ${c.source}, ${c.chapter})`)
      .join('\n---\n');
    const citations: Citation[] = chunks.map(c => ({ source: c.source, chapter: c.chapter, url: c.url }));
    return { context, citations };
  } catch {
    return { context: '', citations: [] };
  }
}

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'text/plain'
];

// Azure OpenAI integration
// Lightweight OCR-only pass used when an image/PDF is uploaded with no typed
// problem text. RAG retrieval needs real problem text to ground on — without
// this, it would query a meaningless placeholder string and return irrelevant
// citations (e.g. geometry chunks for a logarithm problem). This is separate
// from the main solve call, which does its own full OCR+reasoning afterward.
async function extractProblemTextFromImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
  try {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2023-05-15';

    if (!apiKey || !endpoint || !deploymentName) return '';

    const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
    const base64Image = imageBuffer.toString('base64');

    const payload = {
      messages: [
        {
          role: 'system',
          content: 'Read the STEM/math problem shown in this image and output ONLY the problem text itself — no commentary, no explanation, no formatting. If there is no readable problem, output nothing.',
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        },
      ],
      // Reasoning models can silently consume the whole budget on hidden
      // reasoning tokens before producing visible output if this is too low,
      // which sometimes returns an empty completion. 600 leaves real headroom.
      max_completion_tokens: 600,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      console.error('[extractProblemTextFromImage] non-ok response:', response.status, await response.text());
      return '';
    }
    const data = await response.json();
    const text: string = data.choices?.[0]?.message?.content?.trim() || '';
    return text;
  } catch (err) {
    console.error('[extractProblemTextFromImage] threw:', err);
    return '';
  }
}

async function processWithAzureOpenAI(text: string, imageBuffer?: Buffer, mimeType?: string, ragContext?: string) {
  try {
    // Extract environment variables
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2023-05-15';

    if (!apiKey || !endpoint || !deploymentName) {
      throw new Error('Azure OpenAI credentials not properly configured. Please check your environment variables.');
    }

    if (deploymentName.includes('mini') && imageBuffer) {
      console.warn('Mini models may not support vision capabilities.');
    }

    // Prepare the request URL
    const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

    // Prepare the content based on what we have
    const contentFromUser = [];

    const SYSTEM_PROMPT = `You are a helpful STEM tutor specializing in visual explanations. Your task has two parts:

1. Read and understand the STEM problem. If an image or PDF is provided, use OCR to extract the problem. If plain text is provided, use it directly.
2. Analyze the STEM problem and provide a clear, step-by-step solution as Python Manim code.

**REQUIRED OUTPUT FORMAT — follow this structure exactly**:
First, write a plain-text explanation of the solution (3-5 sentences). Describe each step in plain English — what operation is applied, why, and what the result is. Do NOT include any code or math notation in this section, just clear prose.
Then, on a new line, provide the complete Manim code in a Python code block.

Example output structure:
To solve 2x + 5 = 4, we start by subtracting 5 from both sides to isolate the term with x, giving 2x = -1. Next, we divide both sides by 2 to fully isolate x. This gives us x = -1/2 as the final answer.

\`\`\`python
[Manim code here]
\`\`\`

CRITICAL ANIMATION RULES — follow these exactly:

**Cascading Step Display**:
- Show each step of the solution as a new line appearing BELOW all previous steps.
- NEVER remove, fade out, or replace previous steps. Every step stays visible on screen.
- Align all steps to the left, starting near the top-left of the screen.
- Position the first step with: step.to_corner(UL, buff=0.8)
- Position each subsequent step with: step.next_to(previous_step, DOWN, buff=0.4) and step.align_to(first_step, LEFT)
- Animate each step appearing with self.play(Write(step)), then self.wait(0.4) before the next step.

**Boxes / Highlighting**:
- Do NOT use SurroundingRectangle on any intermediate steps.
- ONLY draw one SurroundingRectangle(color=YELLOW) around the FINAL answer after all steps are shown.

**Text**:
- Use Text() for ALL text and equations. NEVER use MathTex() or Tex() — LaTeX is not installed.
- Choose font_size based on the number of steps in your list:
  - 1–5 steps  → font_size=36
  - 6–8 steps  → font_size=30
  - 9–12 steps → font_size=26
  - 13+ steps  → font_size=22

**Math Notation — CRITICAL**:
- NEVER use the ^ caret character for exponents. Instead use Unicode superscript characters directly inside the string:
  - x^2  → "x²"      x^3  → "x³"      x^4  → "x⁴"      x^5  → "x⁵"
  - x^6  → "x⁶"      x^7  → "x⁷"      x^8  → "x⁸"      x^9  → "x⁹"
  - (x+1)^2 → "(x+1)²"    2^n → "2ⁿ"    10^3 → "10³"
- NEVER use "exp(...)" function notation (e.g. "exp(x/6)") — this is confusing for students who haven't seen that notation. Always write it as "e" raised to a power instead. If the exponent is a single digit, use a Unicode superscript (e² , e⁻¹). If the exponent is a longer expression (like "x/6" or "2x + 1") that can't be written as Unicode superscripts, use the make_exp class method (see Exponentials section below) to render it as a real visual superscript — do NOT fall back to "exp(...)" or a caret.
- Use √ for square root (not "sqrt()").
- Use π for pi (not "pi").
- Use × for multiplication in operation lines (not "*").
- Fractions inside plain text (like coefficients): write as "1/2", "-3/4" etc. (slash notation is fine).
- If the original problem uses "/" for a fraction (e.g. "(x² - 4) / (x - 2)"), render it as a proper stacked fraction using make_frac — do NOT write it as plain text with "/" and do NOT switch to "÷". Reserve "÷" only for problems that explicitly use the ÷ symbol.

**Stacked Fractions — d/dx, dy/dx, a/b displayed as proper fractions**:
- When a step contains a derivative (d/dx, dy/dx, d²y/dx²) or any fraction that should render as a stacked visual fraction (numerator on top, denominator below a bar), do NOT write it as plain text. Use the make_frac class method (already included in the Required pattern below).
- make_frac is defined as a method on the Scene class (indented under class SolveEquation(MovingCameraScene):).
- Compute font_size BEFORE calling make_frac (count your total steps first). Build the VGroup step before the steps list, then place the finished VGroup object directly into the list — NOT as a tuple.
- NEVER pre-fill the steps list with tuples and then overwrite entries with steps[N] = var. This causes IndexError. Always place every VGroup inline in the list from the start.
\`\`\`python
# 1. Count steps and compute font_size first
total_n = 5  # replace with your actual step count
font_size = 36 if total_n <= 5 else 30 if total_n <= 8 else 26 if total_n <= 12 else 22

# 2. Pre-build the fraction step
frac = self.make_frac("d", "dx", font_size, BLUE)
rest = Text(" [x³] = 3x²", font_size=font_size, color=BLUE)
rest.next_to(frac, RIGHT, buff=0.12)
deriv_step = VGroup(frac, rest)

# 3. Put it in the list as a bare Mobject (no tuple wrapper)
steps = [
    ("f(x) = x³", WHITE),
    deriv_step,                  # ← bare VGroup, NOT ("...", COLOR)
    ("f'(x) = 3x²", GREEN),
]
\`\`\`
- The required loop (below) handles both tuples and bare Mobjects automatically.
- For the final answer line, if it is a plain equation (e.g. "f'(x) = 3x²"), use normal Text() — only use make_frac when a visible stacked fraction is needed.

**Exponentials — e raised to a multi-character power (e.g. e^(x/6), e^(2x+1))**:
- NEVER write these using "exp(...)" notation or a caret. Use the make_exp class method (already included in the Required pattern below) to render the exponent as a real raised superscript next to the base.
- make_exp is defined as a method on the Scene class, alongside make_frac and make_lim.
- Build the VGroup step before the steps list, exactly like a make_frac step, and place the finished VGroup directly into the list — NOT as a tuple.
\`\`\`python
# e^(x/6) as a real superscript, not "exp(x/6)"
exp_step = self.make_exp("e", "x/6", font_size, WHITE)
# To build a full equation around it, e.g. "x² + 1 = e^(x/6)":
lhs = Text("x² + 1 = ", font_size=font_size, color=WHITE)
exp_part = self.make_exp("e", "x/6", font_size, WHITE)
exp_part.next_to(lhs, RIGHT, buff=0.05)
full_step = VGroup(lhs, exp_part)
\`\`\`
- Put the finished VGroup into steps as a bare Mobject (same pattern as make_frac and make_lim steps).

**Colors**:
- Use WHITE for all intermediate steps.
- Use GREEN for the final answer text.
- Use YELLOW for the SurroundingRectangle around the final answer.

**Scene class — CRITICAL**:
- ALWAYS inherit from MovingCameraScene, never plain Scene. This is required for camera scrolling to work.
  Correct:   class SolveEquation(MovingCameraScene):
  Wrong:     class SolveEquation(Scene):

**Screen Boundaries — MANDATORY**:
- All text must stay within x ∈ [-6, 6] horizontally. Never let a line be so long it clips off screen.
- You MUST track the camera position and scroll automatically. Use this exact logic:
  - Before the loop, set: camera_y = 0
  - After writing each step, check: if step.get_bottom()[1] < camera_y - 3.2:
      needed = (camera_y - 3.2) - step.get_bottom()[1] + 0.5
      self.play(self.camera.frame.animate.shift(DOWN * needed), run_time=0.3)
      camera_y -= needed

**Imports**: Always start with:
\`\`\`python
from manim import *
\`\`\`

**Intermediate Operation Steps**:
- Between each equation line, show an intermediate line that explicitly applies the operation to BOTH sides.
- For example, to solve 2x + 5 = 4:
  1. Show the original equation: "2x + 5 = 4"
  2. Show the operation applied: "2x + 5 - 5 = 4 - 5"   ← subtract 5 from both sides
  3. Show the simplified result: "2x = -1"
  4. Show the next operation: "2x / 2 = -1 / 2"          ← divide both sides by 2
  5. Show the final result: "x = -1/2"                    ← GREEN, with yellow box
- Operation lines (step 2, 4 above) use color=BLUE to visually distinguish them from result lines.
- Result lines (step 1, 3, 5 above) use color=WHITE (or GREEN for the final answer).

**Step Labels — REQUIRED**:
- Before each BLUE operation line, add a short GRAY label that explains what operation is being applied and why.
- Keep labels concise (under 60 characters).
- Examples:
  ("Subtract 5 from both sides to isolate x:", GRAY)
  ("Divide both sides by 2 to solve for x:", GRAY)
  ("Apply power rule: multiply by exponent, reduce power by 1:", GRAY)
  ("Integrate each term separately:", GRAY)

**Calculus — Derivatives (CRITICAL)**:
- For ANY derivative problem, you MUST show the power rule applied to EACH TERM individually before combining.
- Do NOT skip straight from f(x) to f'(x). Show every term's differentiation as its own BLUE step.
- Example for f(x) = 3x³ - 2x² + x - 7:
  1. "f(x) = 3x³ - 2x² + x - 7"  (WHITE)
  2. "d/dx [3x³] = 3 × 3x² = 9x²"  (BLUE)  ← power rule on first term (use make_frac for d/dx)
  3. "d/dx [-2x²] = -2 × 2x = -4x"  (BLUE)  ← power rule on second term
  4. "d/dx [x] = 1"  (BLUE)  ← power rule on third term
  5. "d/dx [-7] = 0"  (BLUE)  ← constant rule
  6. "Now add all the parts together:"  (GRAY)  ← transition label before final answer
  7. "f'(x) = 9x² - 4x + 1"  (GREEN)  ← combine all results, final answer
- ALWAYS include the "Now add all the parts together:" GRAY label as the second-to-last step in every derivative problem, right before the GREEN final answer line.
- When writing the bracket portion next to make_frac (e.g. "[3x³] = 9x²"), always start the Text string with a space: " [3x³] = 9x²" so it doesn't touch the fraction bar.
- For d/dx steps that include the bracket notation, use make_frac to render d/dx as a stacked fraction next to the bracketed term.

**Calculus — Limits (CRITICAL)**:
- For ANY limit problem, display the limit symbol as a proper stacked notation using make_lim (defined below):
  - "lim" on top, "x→a" (or "x→∞" etc.) as a smaller label directly below it.
  - NEVER write "lim x→2" as a single flat text string. Always use make_lim so it renders like real math.
- Example for lim x→2 (x² - 4)/(x - 2):
  1. VGroup(make_lim("x→2"), make_frac("x² - 4", "x - 2"))  (WHITE)  ← stacked fraction next to lim
  2. "Factor numerator to simplify:"  (GRAY)
  3. VGroup(make_lim("x→2"), make_frac("(x-2)(x+2)", "x-2"))  (BLUE)
  4. "Cancel (x - 2) from top and bottom:"  (GRAY)
  5. VGroup(make_lim("x→2"), Text(" (x + 2)"))  (BLUE)
  6. "Evaluate the limit by direct substitution:"  (GRAY)
  7. "lim = 2 + 2 = 4"  (GREEN)
- To build a limit-with-fraction step:
\`\`\`python
lim_grp = self.make_lim("x→2", font_size, WHITE)
frac = self.make_frac("x² - 4", "x - 2", font_size, WHITE)
frac.next_to(lim_grp, RIGHT, buff=0.2)
step = VGroup(lim_grp, frac)
\`\`\`
- For limit steps without a fraction (e.g. after cancelling), attach a Text object instead of make_frac:
\`\`\`python
lim_grp = self.make_lim("x→2", font_size, BLUE)
rest = Text(" (x + 2)", font_size=font_size, color=BLUE)
rest.next_to(lim_grp, RIGHT, buff=0.12)
step = VGroup(lim_grp, rest)
\`\`\`
- Put every finished VGroup into steps as a bare Mobject (same pattern as make_frac steps).

**Calculus — Integrals (CRITICAL)**:
- For ANY integral problem, show the power rule for integration applied to EACH TERM individually.
- ALWAYS put a space between ∫ and the expression that follows it — e.g. "∫ 4x³ dx" not "∫4x³ dx". The integral glyph overlaps adjacent characters if there is no space.
- Example for ∫(4x³ + 2x)dx:
  1. "∫ (4x³ + 2x) dx"  (WHITE)
  2. "∫ 4x³ dx = 4 × x⁴/4 = x⁴"  (BLUE)  ← integrate first term
  3. "∫ 2x dx = 2 × x²/2 = x²"  (BLUE)  ← integrate second term
  4. "∫ (4x³ + 2x) dx = x⁴ + x² + C"  (GREEN)  ← combine, final answer

**Voice Narration — REQUIRED**:
- Every entry in the steps list MUST have a trailing comment in this exact format:  # tts: spoken text here
- The spoken text must be plain English with NO math symbols — spell everything out as it would be read aloud.
  - "²" → "squared",  "³" → "cubed",  "√" → "square root of",  "∫" → "integral of"
  - "π" → "pi",  "×" → "times",  "÷" → "divided by",  "=" → "equals",  "≠" → "not equal to"
  - "-3" → "negative 3",  "1/2" → "one half"
  - "d/dx [term]" → "the derivative of [term]"  e.g. "d/dx [3x³] = 9x²" → "the derivative of 3x cubed equals 9x squared"
  - Never say "d d x" — always say "the derivative of" followed by what's inside the bracket
  - Never say "open parenthesis" or "close parenthesis" — just omit them. "(4x + 2)" → "4x plus 2"
  - "÷" or "/" in an expression → "divided by". Never say "numerator" or "denominator" for ÷ or / expressions — those words are only for stacked fractions (make_frac steps).
  - "lim x→2" → "the limit as x approaches 2"
  - "e^(x/6)" or any make_exp step → "e to the power of x over 6" (spell out the exponent in words, never say "exp")
- Keep each narration short — one sentence per step, under 15 words.
- Example:
  ("2x + 5 = 4", WHITE),  # tts: We start with the equation 2x plus 5 equals 4
  ("Subtract 5 from both sides to isolate x:", GRAY),  # tts: Subtract 5 from both sides to isolate x
  ("2x + 5 - 5 = 4 - 5", BLUE),  # tts: Subtracting 5 from both sides gives 2x equals negative 1
  ("2x = -1", WHITE),  # tts: Simplified to 2x equals negative 1
  ("x = -1/2", GREEN),  # tts: The final answer is x equals negative one half

**Required pattern — use this exact structure**:
\`\`\`python
from manim import *

class SolveEquation(MovingCameraScene):
    def make_frac(self, num_str, den_str, fs, color):
        num = Text(num_str, font_size=fs, color=color)
        den = Text(den_str, font_size=fs, color=color)
        w = max(num.width, den.width) + 0.12
        bar = Line(LEFT * w / 2, RIGHT * w / 2, color=color, stroke_width=2)
        num.next_to(bar, UP, buff=0.07)
        den.next_to(bar, DOWN, buff=0.07)
        return VGroup(num, bar, den)

    def make_lim(self, under_str, fs, color):
        lim = Text("lim", font_size=fs, color=color)
        sub = Text(under_str, font_size=int(fs * 0.65), color=color)
        sub.next_to(lim, DOWN, buff=0.04)
        sub.align_to(lim, LEFT)
        return VGroup(lim, sub)

    def make_exp(self, base_str, exp_str, fs, color):
        base = Text(base_str, font_size=fs, color=color)
        exponent = Text(exp_str, font_size=int(fs * 0.6), color=color)
        exponent.next_to(base, UR, buff=0.02).shift(LEFT * exponent.width * 0.3)
        return VGroup(base, exponent)

    def construct(self):
        # Steps list: each entry is either a ("text", COLOR) tuple or a pre-built Mobject.
        # For calculus: pre-build fraction steps with make_frac and put them in as bare Mobjects.
        steps = [
            ("2x + 5 = 4", WHITE),                             # tts: We start with the equation 2x plus 5 equals 4
            ("Subtract 5 from both sides to isolate x:", GRAY),# tts: Subtract 5 from both sides to isolate x
            ("2x + 5 - 5 = 4 - 5", BLUE),                     # tts: Subtracting 5 gives 2x equals negative 1
            ("2x = -1", WHITE),                                # tts: Simplified to 2x equals negative 1
            ("Divide both sides by 2 to solve for x:", GRAY),  # tts: Divide both sides by 2 to find x
            ("2x ÷ 2 = -1 ÷ 2", BLUE),                        # tts: Dividing both sides by 2
            ("x = -1/2", GREEN),                               # tts: The final answer is x equals negative one half
        ]

        n = len(steps)
        font_size = 36 if n <= 5 else 30 if n <= 8 else 26 if n <= 12 else 22

        step_objects = []
        camera_y = 0

        for i, step_data in enumerate(steps):
            # Handle both ("text", color) tuples and pre-built Mobjects
            if isinstance(step_data, tuple):
                step = Text(step_data[0], font_size=font_size, color=step_data[1])
            else:
                step = step_data  # already a Mobject (VGroup etc.)

            if not step_objects:
                step.to_corner(UL, buff=0.8)
            else:
                step.next_to(step_objects[-1], DOWN, buff=0.35)
                step.align_to(step_objects[0], LEFT)

            self.play(Write(step), run_time=0.6)
            self.wait(0.4)
            step_objects.append(step)

            if step.get_bottom()[1] < camera_y - 3.2:
                needed = (camera_y - 3.2) - step.get_bottom()[1] + 0.5
                self.play(self.camera.frame.animate.shift(DOWN * needed), run_time=0.3)
                camera_y -= needed

        final_box = SurroundingRectangle(step_objects[-1], color=YELLOW)
        self.play(Create(final_box))
        self.wait(2)
\`\`\`

Adapt the steps list to match the actual problem. Always show the operation applied to both sides (BLUE) before showing the simplified result (WHITE). The final answer is always GREEN with a YELLOW box. Remember: no ^ carets — use ² ³ ⁴ etc. for exponents.`;
    
    // Build user text — prepend RAG context when available
    const fullText = ragContext
      ? `Relevant textbook material for this problem:\n---\n${ragContext}\n---\n\nProblem to solve:\n${text}`
      : text;

    if (fullText) {
      contentFromUser.push({ type: "text", text: fullText });
    }
    
    // Add image content if available (for GPT-4 Vision)
    if (imageBuffer) {
      // Convert buffer to base64
      const base64Image:string = Buffer.from(imageBuffer).toString('base64');
      contentFromUser.push({
        type: "image_url",
        image_url: {
          url: `data:${mimeType || 'image/jpeg'};base64,${base64Image}`
        }
      });
    }

    // Create the request payload.
    // Reasoning models (gpt-5-mini) require plain string content for text-only messages.
    // Only use the content array format when an image is included.
    const userContent = imageBuffer ? contentFromUser : (text || '');

    const payload = {
      messages: [
        { //This is the system prompt
          role: "system",
          content: SYSTEM_PROMPT
        },
        { //This is the user prompt
          role: "user",
          content: userContent
        }
      ],
      max_completion_tokens: 8000
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Detailed API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      
      let errorData; //Initialize errorData to null
      try {
        errorData = JSON.parse(errorText); //Try to parse the error text as JSON
      } catch {
        errorData = { error: errorText };
      }
      
      // Check for specific error types
      const visionErrorKeywords = [ //checks for visions incapabilities with the openAI model I am using
        'does not support vision',
        'multimodal',
        'image input',
        'vision capabilities',
        'image_url'
      ];
      
      if (response.status === 400 && visionErrorKeywords.some(keyword => errorText.toLowerCase().includes(keyword))) { //checks if errortext includes any of these keywords and raises an error if it does, stating that there is the problem with the openAI model
        console.error('The current deployment does not support vision capabilities'); //logs the error in terminal
        throw new Error(`Your Azure OpenAI deployment (${deploymentName}) does not support vision capabilities. Please use a GPT-4 Vision model.`); //throws an error to the user via UI
      }
      
      throw new Error(`Azure OpenAI API error: ${JSON.stringify(errorData)}`); //throws a general API error to the user via UI
    }

    const data = await response.json();
    const AIGeneratedMessage = data.choices[0]?.message?.content || data.choices[0]?.message?.reasoning_content || '';

    let solution = AIGeneratedMessage;
    let manimCode = '';
    
    // Try different patterns to extract Manim code
    const codeBlockPatterns = [
      // Pattern 1: ```python ... ``` or ```manim ... ```
      /```(?:python|manim)([\s\S]*?)```/g,
      // Pattern 2: ``` ... ``` (any code block)
      /```([\s\S]*?)```/g,
      // Pattern 3: Look for class definitions that inherit from Scene
      /class\s+\w+\s*\([\s\S]*?Scene\)[\s\S]*?def\s+construct\([\s\S]*?def\s+\w+\s*\([\s\S]*?\).*?\{[\s\S]*?\}/g,
    ];
    
    let manimCodeMatches: RegExpMatchArray[] = []; //this array has type RegExpMatchArray[]
    
    // Try each pattern until we find matches
    for (const pattern of codeBlockPatterns) {
      const matches = [...AIGeneratedMessage.matchAll(pattern)]; //turns the matches into an array
      if (matches.length > 0) { //if we find matches
        manimCodeMatches = matches;
        break;
      }
    }
    
    if (manimCodeMatches.length > 0) { //there is a match
      // Get the last code block as it's likely the final implementation
      const lastMatch = manimCodeMatches[manimCodeMatches.length - 1]; //getting the code without the '''python marker
      manimCode = lastMatch[1]?.trim() || ''; //trimming white space if needed
      if (manimCode) {
        
        // Clean up the code if it has any markdown formatting left
        if (manimCode.startsWith('python') || manimCode.startsWith('manim')) { //extra layer of checking for formatting issues
          manimCode = manimCode.split('\n').slice(1).join('\n').trim();
        }

        // Remove all code blocks from the solution text
        for (const match of manimCodeMatches) {
          solution = solution.replace(match[0], ''); //removing the code blocks from the solution text. This keeps the solution text cleaner and shorter
        }
        solution = solution.trim(); //trimming white space if needed

      } else {
        console.warn('Found code blocks but could not extract valid Manim code');
        manimCode = '';
      }
    } else {
      console.warn('No Manim code blocks found in the response');

      // Fallback 1: The entire response IS the Manim script (no fences, starts with import)
      const looksLikeManimScript = /from\s+manim\s+import/.test(AIGeneratedMessage) &&
        /class\s+\w+\s*\(\s*(?:\w+Scene|Scene)\s*\)/.test(AIGeneratedMessage);

      if (looksLikeManimScript) {
        manimCode = AIGeneratedMessage.trim();
        solution = '';
      } else {
        // Fallback 2: find a Scene class anywhere in the text
        const sceneMatch = AIGeneratedMessage.match(/((?:from manim import[\s\S]*?)?class\s+\w+\s*\(\s*(?:\w+Scene|Scene)\s*\)[\s\S]*)/);
        if (sceneMatch) {
          manimCode = sceneMatch[1].trim();
          solution = AIGeneratedMessage.slice(0, AIGeneratedMessage.indexOf(sceneMatch[1])).trim();
        } else {
          console.warn('No Manim code could be extracted, returning text solution only');
          manimCode = '';
        }
      }
    }

    // If solution text is empty after extracting code blocks, provide a fallback message
    if (!solution.trim() && manimCode) {
      solution = 'A visual animation has been generated for this problem. Click "Generate Animation" below to watch the step-by-step explanation.';
    } else if (!solution.trim() && !manimCode) {
      solution = 'The AI did not return a solution. Please try again or rephrase your problem.';
    }

    return {
      success: true,
      solution,
      manimCode
    };

  } catch (error: unknown) {
    console.error('Error processing request:', error);
    const errorMessage = error instanceof Error
      ? (error.name === 'AbortError' ? 'Request timed out after 90 seconds. The AI is taking too long — please try again.' : error.message)
      : 'Unknown error';
    return {
      success: false,
      solution: 'An unexpected error occurred while processing your request.',
      manimCode: '',
      error: errorMessage
    };
  }
}

async function validateAndProcessRequest(request: NextRequest): Promise<ProcessResponse> {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const problemText = formData.get('problemText') as string | null;

  if (!file && !problemText?.trim()) {
    return {
      success: false,
      solution: '',
      manimCode: '',
      error: 'Either a file or problem text is required'
    };
  }

  if (file) {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        success: false,
        solution: '',
        manimCode: '',
        error: `Unsupported file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        solution: '',
        manimCode: '',
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      };
    }

    const bytes: ArrayBuffer = await file.arrayBuffer();
    const buffer: Buffer = Buffer.from(bytes);

    try {
      const fileContext: string = `This is a ${file.type} file containing a STEM problem that needs to be solved and visualized.`;
      let combinedText: string = fileContext;
      if (problemText?.trim()) {
        combinedText = `${fileContext}\n\n${problemText}`;
      }

      // RAG needs real problem text to ground on. If the user typed something,
      // use that directly; otherwise run a fast OCR-only pass over the image
      // first so retrieval isn't querying a meaningless placeholder.
      let ragQuery = problemText?.trim() || '';
      if (!ragQuery) {
        ragQuery = await extractProblemTextFromImage(buffer, file.type);
      }

      const { context, citations } = await fetchRAGContext(ragQuery);
      const result = await processWithAzureOpenAI(combinedText, buffer, file.type, context);
      return { ...result, citations };

    } catch (error) {
      console.error('Error processing file:', error);
      return {
        success: false,
        solution: '',
        manimCode: '',
        error: 'Failed to process the uploaded file.'
      };
    }
  } else {
    try {
      const { context, citations } = await fetchRAGContext(problemText!.trim());
      const result = await processWithAzureOpenAI(problemText!.trim(), undefined, undefined, context);
      return { ...result, citations };
    } catch (error) {
      console.error('Error processing text problem:', error);
      return {
        success: false,
        solution: '',
        manimCode: '',
        error: 'Failed to process the problem text.'
      };
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await validateAndProcessRequest(request);

    if (result.success) {
      return NextResponse.json({
        success: true,
        solution: result.solution,
        manimCode: result.manimCode,
        citations: result.citations ?? [],
      } as ProcessResponse);
    } else {
      // Return error response with 400 status
      const errorResponse: ProcessResponse = {
        success: false,
        solution: '',
        manimCode: '',
        error: result.error || 'Failed to process your request. Please check your input and try again.',
        ...(result.error?.includes('file') && {
          suggestion: 'Please ensure the file is not corrupted and is in a supported format (JPG, PNG, PDF, TXT).'
        })
      };
      return NextResponse.json(errorResponse, { 
        status: 400,
        statusText: 'Bad Request'
      });
    }
    
  } catch (error) {
    // Log the full error for debugging
    console.error('Unexpected error in process-problem endpoint:', error);
    
    // Determine error type for more specific messaging
    let errorMessage = 'Our system encountered an unexpected error while processing your request.';
    let errorSuggestion = 'Please try again in a few minutes. If the problem persists, please contact support.';
    
    // Check for common error types
    if (error instanceof Error) {
      if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error occurred while connecting to our AI service.';
        errorSuggestion = 'Please check your internet connection and try again.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'The request took too long to process.';
        errorSuggestion = 'Please try again. If the issue continues, the server might be under heavy load.';
      } else if (error.message.includes('authentication') || error.message.includes('credentials')) {
        errorMessage = 'Authentication failed when connecting to the AI service.';
        errorSuggestion = 'This appears to be a server configuration issue. Please contact support.';
      }
    }
    
    const errorResponse: ProcessResponse = {
      success: false,
      solution: '',
      manimCode: '',
      error: errorMessage,
      suggestion: errorSuggestion,
      ...(process.env.NODE_ENV === 'development' && {
        debugInfo: {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        }
      })
    };
    
    return NextResponse.json(errorResponse, { 
      status: 500,
      statusText: 'Internal Server Error'
    });
  }
}
