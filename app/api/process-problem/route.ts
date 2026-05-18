import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Allow this route up to 120 seconds (reasoning models can be slow)
export const maxDuration = 120;

// Define types for better type safety

interface ProcessResponse {
  success: boolean;
  solution: string;
  manimCode: string;
  visualizationDescription?: string;
  error?: string;
  suggestion?: string;  // User-friendly suggestions for resolving the issue
  debugInfo?: {        // Additional debug information (only in development)
    error?: string;
    stack?: string;
    timestamp?: string;
  };
}

// Constants
const UPLOAD_DIR = 'public/uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'text/plain'
];

// Azure OpenAI integration
async function processWithAzureOpenAI(text: string, imageBuffer?: Buffer, mimeType?: string) {
  try {
    // Extract environment variables
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2023-05-15';

    if (!apiKey || !endpoint || !deploymentName) {
      throw new Error('Azure OpenAI credentials not properly configured. Please check your environment variables.');
    }
    
    // Log the configuration for debugging
    console.log('Azure OpenAI Configuration:', {
      endpoint,
      deploymentName,
      apiVersion,
      hasApiKey: !!apiKey,
      hasImageBuffer: !!imageBuffer,
      imageBufferSize: imageBuffer ? imageBuffer.length : 0,
      textContent: text ? text.substring(0, 100) + '...' : 'None'
    });
    
    // Check if we're using a mini model which might not support vision. Not sure if I need this!!!
    if (deploymentName.includes('mini') && imageBuffer) {
      console.warn('Warning: Using a "mini" model with image content. Mini models may not support vision capabilities.');
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
- Animate each step appearing with self.play(Write(step)), then self.wait(0.5) before the next step.

**Boxes / Highlighting**:
- Do NOT use SurroundingRectangle on any intermediate steps.
- ONLY draw one SurroundingRectangle(color=YELLOW) around the FINAL answer after all steps are shown.

**Text**:
- Use Text() for ALL text and equations. NEVER use MathTex() or Tex() — LaTeX is not installed.
- Use font_size=36 for steps. If there are many steps, reduce to font_size=28 so they all fit on screen.

**Colors**:
- Use WHITE for all intermediate steps.
- Use GREEN for the final answer text.
- Use YELLOW for the SurroundingRectangle around the final answer.

**Screen Boundaries**:
- Keep all content within -6.5 to 6.5 horizontal and -3.5 to 3.5 vertical.
- If steps risk going off the bottom, reduce font_size or add self.camera.frame.animate.shift(DOWN * n) to scroll.

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

**Required pattern — use this exact structure**:
\`\`\`python
from manim import *

class SolveEquation(Scene):
    def construct(self):
        # Each tuple: (text, color)
        # BLUE = operation applied to both sides, WHITE = simplified result, GREEN = final answer
        steps = [
            ("2x + 5 = 4", WHITE),
            ("2x + 5 - 5 = 4 - 5", BLUE),
            ("2x = -1", WHITE),
            ("2x / 2 = -1 / 2", BLUE),
            ("x = -1/2", GREEN),
        ]

        step_objects = []

        for i, (step_text, color) in enumerate(steps):
            step = Text(step_text, font_size=36, color=color)

            if not step_objects:
                step.to_corner(UL, buff=0.8)
            else:
                step.next_to(step_objects[-1], DOWN, buff=0.4)
                step.align_to(step_objects[0], LEFT)

            self.play(Write(step))
            self.wait(0.5)
            step_objects.append(step)

        # Box only the final answer
        final_box = SurroundingRectangle(step_objects[-1], color=YELLOW)
        self.play(Create(final_box))
        self.wait(2)
\`\`\`

Adapt the steps list to match the actual problem. Always show the operation applied to both sides (BLUE) before showing the simplified result (WHITE). The final answer is always GREEN with a YELLOW box.`;
    
    // Add text content if available
    if (text) {
      contentFromUser.push({
        type: "text",
        text: text
      });
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
      max_completion_tokens: 4000
    };

    // Make the API request
    console.log('Sending request to Azure OpenAI with payload:', {
      url,
      messageCount: payload.messages.length,
      hasImageContent: payload.messages.some(m =>
        Array.isArray(m.content) &&
        m.content.some(c => c.type === 'image_url')
      )
    });

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
      } catch (e) {
        errorData = { error: errorText }; //If it fails, set errorData to the error text
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

    const data = await response.json(); //converts the response from Azure OpenAI to JSON so we can use it as a javascript object
    
    // Extract the solution text and Manim code from the response
    console.log('Full API response:', JSON.stringify(data, null, 2)); //log full response to debug empty content
    const AIGeneratedMessage = data.choices[0]?.message?.content || data.choices[0]?.message?.reasoning_content || ''; //gets the AI generated message from the response
    console.log('Raw assistant message: \n\n', AIGeneratedMessage); //logs the AI generated message to the terminal
    
    // Parse the response to extract solution text, visualization description, and Manim code
    let solution = AIGeneratedMessage;
    let manimCode = '';
    let visualizationDescription = '';
    
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
        console.log(`Found ${manimCodeMatches.length} code blocks using pattern:`, pattern); //logs the number of code blocks found using the pattern and the pattern itself
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

        console.log('Extracted Manim code: \n \n' + manimCode); //logs the extracted Manim code
        
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
        /class\s+\w+\s*\(\s*Scene\s*\)/.test(AIGeneratedMessage);

      if (looksLikeManimScript) {
        manimCode = AIGeneratedMessage.trim();
        solution = ''; // whole response is code, nothing left for solution text
        console.log('Treating entire response as bare Manim script');
      } else {
        // Fallback 2: find a Scene class anywhere in the text
        const sceneMatch = AIGeneratedMessage.match(/((?:from manim import[\s\S]*?)?class\s+\w+\s*\(\s*Scene\s*\)[\s\S]*)/);
        if (sceneMatch) {
          manimCode = sceneMatch[1].trim();
          solution = AIGeneratedMessage.slice(0, AIGeneratedMessage.indexOf(sceneMatch[1])).trim();
          console.log('Extracted Manim code via Scene class pattern');
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

    return { //we don't experience any errors so we return the solution, manim code, and visualization description
      success: true,
      solution,
      manimCode,
      visualizationDescription
    };

  } catch (error: unknown) { //catches any errors that occur
    console.error('Error processing request:', error); //logs the error in terminal
    const errorMessage = error instanceof Error
      ? (error.name === 'AbortError' ? 'Request timed out after 90 seconds. The AI is taking too long — please try again.' : error.message)
      : 'Unknown error';
    return { //return the error to the user
      success: false,
      solution: 'An unexpected error occurred while processing your request.', //returns a general error message to the user
      manimCode: '',
      visualizationDescription: '',
      error: errorMessage
    };
  }
}

async function validateAndProcessRequest(request: NextRequest): Promise<ProcessResponse> { //function that returns a promise. Function takes in request of type NextRequest, and returns a promise of type ProcessResponse
  const formData = await request.formData(); //gets the form data from the request
  const file = formData.get('file') as File | null; //gets the file from the form data
  const problemText = formData.get('problemText') as string | null; //gets the problem text from the form data
  
  // Validate input: checking if the user has uploaded a file or provided problem text
  if (!file && !problemText?.trim()) {
    return { //return an error to the user
      success: false,
      solution: '',
      manimCode: '',
      error: 'Either a file or problem text is required'
    };
  }
  
  // Handle file upload if present
  if (file) {
    // Validate file type: checking if the file is a PDF, image, or text file
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        success: false,
        solution: '',
        manimCode: '',
        error: `Unsupported file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`
      };
    }
    
    // Validate file size: checking if the file is too large
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        solution: '',
        manimCode: '',
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      };
    }
    
    const bytes: ArrayBuffer = await file.arrayBuffer(); //converts the file to a arrayBuffer
    const buffer:Buffer = Buffer.from(bytes); //converts the arrayBuffer to a buffer. Buffers are what are used in node.js 
    
    try { //try to process the file
      // Create uploads directory if it doesn't exist
      const uploadDir:string = join(process.cwd(), UPLOAD_DIR);
      await mkdir(uploadDir, { recursive: true });
      
      // Save the file with a unique name
      const uniqueId:string = uuidv4(); //generates a unique id for the file
      const filename:string = `${uniqueId}-${file.name.replace(/[^\w.]+/g, '-')}`; //removes any special characters from the file name
      const filepath:string = join(uploadDir, filename); //joins the upload directory and the file name
      await writeFile(filepath, buffer); //writes the file to the upload directory
      
      // Add context about the file type to help the AI
      const fileContext:string = `This is a ${file.type} file containing a STEM problem that needs to be solved and visualized.`;
      
      // Initialize combinedText with the file context
      let combinedText:string = fileContext;
      // If there's additional problem text, append it with some spacing
      if (problemText?.trim()) {
        combinedText = `${fileContext}\n\n${problemText}`;
      }
      
      // Process with Azure OpenAI (uses GPT-4 Vision for images/PDFs)
      return await processWithAzureOpenAI(combinedText, buffer, file.type);

    } catch (error) { //catches any errors that occur
      console.error('Error processing file:', error); //logs the error in terminal
      return { //returns an error to the user
        success: false,
        solution: '',
        manimCode: '',
        error: "Failed to process the uploaded file. Didn't even get to the processing stage with Azure openAI"
      };
    }
  } else { //if no file was uploaded, process the text-only problem
    // Process text-only problem
    try {
      return await processWithAzureOpenAI(problemText!.trim())
    } catch (error) { //catches any errors that occur
      console.error('Error processing text problem:', error); //logs the error in terminal
      return { //returns an error to the user
        success: false,
        solution: '',
        manimCode: '',
        error: 'Failed to process the problem text. Didn\'t even get to the processing stage with Azure openAI'
      };
    }
  }
}

export async function POST(request: NextRequest) { //exports the POST function
  try {
    const result = await validateAndProcessRequest(request); //calls the validateAndProcessRequest function
    
    if (result.success) { //if the request was successful
      return NextResponse.json({
        success: true,
        solution: result.solution,
        manimCode: result.manimCode,
        visualizationDescription: result.visualizationDescription,
        error: undefined // Explicitly set to undefined to match the type
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
