import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Define types for better type safety


interface ProcessRequest {
  file?: File;
  problemText?: string;
}

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
async function processWithAzureOpenAI(text: string, imageBuffer?: Buffer) {
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

    const SYSTEM_PROMPT = `You are a helpful STEM tutor specializing in visual explanations. Your task has three parts:

1. Use OCR to read and understand any text in the uploaded image or PDF.
2. Analyze the STEM problem and provide a clear, step-by-step solution.
3. Create a detailed description of how to visualize this solution, followed by Python code using the Manim library that implements this visualization.

For the visualization:
- First describe in natural language what the animation should show and how it should progress
- Then provide well-commented Manim code that implements this visualization
- Always include these imports at the top of your Manim code:
  \`\`\`python
  from manim import *
  \`\`\`
- To highlight elements, use this pattern:
  \`\`\`python
  class MyScene(Scene):
      def construct(self):
          # First create the object to highlight
          equation = MathTex('2 + 2 = 4')
          self.play(Write(equation))
          
          # Create and animate a rectangle around it
          rect = SurroundingRectangle(equation, color=YELLOW)
          self.play(Create(rect))  # <-- IMPORTANT: Use Create() with SurroundingRectangle
          
          # Wait a moment before continuing
          self.wait()
  \`\`\`
- IMPORTANT: Always use self.play(Create(object)) or self.play(Write(object)) to animate objects
- Ensure the visualization illustrates the key concepts in the problem
- Use appropriate colors, labels, and animations to make the explanation clear`;
    
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
          url: `data:image/jpeg;base64,${base64Image}`
        }
      });
    }

    // Create the request payload
    const payload = {
      messages: [
        { //This is the system prompt
          role: "system",
          content: SYSTEM_PROMPT
        },
        { //This is the user prompt
          role: "user",
          content: contentFromUser
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
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

    const response = await fetch(url, {
      method: 'POST', //Indicates that we are using the HTTP POST method
      headers: {
        'Content-Type': 'application/json',  //Indicates that we are sending JSON data
        'api-key': apiKey //Indicates that we are using the API key for authentication
      },
      body: JSON.stringify(payload) //We specified before that we are sending a JSON object, but the payload is just a list, so stringifying it turns it into a JSON string
    });

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
        'image_url',
        'not supported'
      ];
      
      if (response.status === 400 && visionErrorKeywords.some(keyword => errorText.toLowerCase().includes(keyword))) { //checks if errortext includes any of these keywords and raises an error if it does, stating that there is the problem with the openAI model
        console.error('The current deployment does not support vision capabilities'); //logs the error in terminal
        throw new Error(`Your Azure OpenAI deployment (${deploymentName}) does not support vision capabilities. Please use a GPT-4 Vision model.`); //throws an error to the user via UI
      }
      
      throw new Error(`Azure OpenAI API error: ${JSON.stringify(errorData)}`); //throws a general API error to the user via UI
    }

    const data = await response.json(); //converts the response from Azure OpenAI to JSON so we can use it as a javascript object
    
    // Extract the solution text and Manim code from the response
    const AIGeneratedMessage = data.choices[0]?.message?.content || ''; //gets the AI generated message from the response
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
        console.warn('Found code blocks but could not extract valid Manim code'); //logs a warning if we find code blocks but could not extract valid Manim code
        throw new Error('Found code blocks but could not extract valid Manim code');
      }
    } else {
      console.warn('No Manim code blocks found in the response'); //logs a warning if we find no Manim code blocks in the response
      // If no code blocks found, try to extract any Python code that looks like Manim. This is like last last resort if nothing else works
      const pythonCodeMatch = AIGeneratedMessage.match(/(class\s+\w+\s*\([\s\S]*?Scene\)[\s\S]*?def\s+construct\([\s\S]*?def\s+\w+\s*\([\s\S]*?\).*?\{[\s\S]*?\})/); //BS i don't understand
      if (pythonCodeMatch) {
        manimCode = pythonCodeMatch[1].trim();
        console.log('Extracted Manim code from raw text (first 200 chars):', manimCode.substring(0, 200) + '...');
      } else { //Throw error if no Manim code could be extracted at all
        console.warn('No Manim code could be extracted, continuing without visualization');
        throw new Error('No Manim code could be extracted, continuing without visualization');
      }
    }

    return { //we don't experience any errors so we return the solution, manim code, and visualization description
      success: true,
      solution,
      manimCode,
      visualizationDescription
    };

  } catch (error: unknown) { //catches any errors that occur
    console.error('Error processing request:', error); //logs the error in terminal
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'; //check what type the error is
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
      return await processWithAzureOpenAI(combinedText, buffer);

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
