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
}

// Constants
const UPLOAD_DIR = 'uploads';
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
    
    // Check if we're using a mini model which might not support vision
    if (deploymentName.includes('mini') && imageBuffer) {
      console.warn('Warning: Using a "mini" model with image content. Mini models may not support vision capabilities.');
    }

    // Prepare the request URL
    const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

    // Prepare the content based on what we have
    const content = [];
    
    // Add text content if available
    if (text) {
      content.push({
        type: "text",
        text: text
      });
    }
    
    // Add image content if available (for GPT-4 Vision)
    if (imageBuffer) {
      // Convert buffer to base64
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      content.push({
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${base64Image}`
        }
      });
    }

    // Create the request payload
    const payload = {
      messages: [
        {
          role: "system",
          content: `You are a helpful STEM tutor specializing in visual explanations. Your task has three parts:

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
- Use appropriate colors, labels, and animations to make the explanation clear`
        },
        {
          role: "user",
          content: content
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    };

    // Make the API request
    try {
      console.log('Sending request to Azure OpenAI with payload:', {
        url,
        messageCount: payload.messages.length,
        hasImageContent: payload.messages.some(m => 
          Array.isArray(m.content) && 
          m.content.some(c => c.type === 'image_url')
        )
      });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Azure OpenAI API error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText };
        }
        
        // Check for specific error types
        const visionErrorKeywords = [
          'does not support vision',
          'multimodal',
          'image input',
          'vision capabilities',
          'image_url',
          'not supported'
        ];
        
        if (response.status === 400 && visionErrorKeywords.some(keyword => errorText.toLowerCase().includes(keyword))) {
          console.error('The current deployment does not support vision capabilities');
          throw new Error(`Your Azure OpenAI deployment (${deploymentName}) does not support vision capabilities. Please use a GPT-4 Vision model.`);
        }
        
        throw new Error(`Azure OpenAI API error: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
    
    // Extract the solution text and Manim code from the response
    const assistantMessage = data.choices[0]?.message?.content || '';
    console.log('Raw assistant message:', assistantMessage.substring(0, 200) + '...');
    
    // Parse the response to extract solution text, visualization description, and Manim code
    let solution = assistantMessage;
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
    
    let manimCodeMatches: RegExpMatchArray[] = [];
    
    // Try each pattern until we find matches
    for (const pattern of codeBlockPatterns) {
      const matches = [...assistantMessage.matchAll(pattern)];
      if (matches.length > 0) {
        manimCodeMatches = matches;
        console.log(`Found ${manimCodeMatches.length} code blocks using pattern:`, pattern);
        break;
      }
    }
    
    if (manimCodeMatches.length > 0) {
      // Get the last code block as it's likely the final implementation
      const lastMatch = manimCodeMatches[manimCodeMatches.length - 1];
      manimCode = lastMatch[1]?.trim() || '';
      
      if (manimCode) {
        console.log('Extracted Manim code (first 200 chars):', manimCode.substring(0, 200) + '...');
        
        // Clean up the code if it has any markdown formatting left
        if (manimCode.startsWith('python') || manimCode.startsWith('manim')) {
          manimCode = manimCode.split('\n').slice(1).join('\n').trim();
        }
        
        // Remove all code blocks from the solution text
        solution = assistantMessage;
        for (const match of manimCodeMatches) {
          solution = solution.replace(match[0], '');
        }
        solution = solution.trim();
        
        // Try to extract the visualization description
        const visualizationKeywords = [
          'visualization', 'animation', 'visual explanation', 'manim',
          'scene', 'animate', 'diagram', 'illustration'
        ];
        
        // Look for a paragraph that describes the visualization
        const paragraphs = solution.split('\n\n');
        for (const paragraph of paragraphs) {
          const lowerParagraph = paragraph.toLowerCase();
          if (visualizationKeywords.some(keyword => lowerParagraph.includes(keyword))) {
            visualizationDescription = paragraph.trim();
            break;
          }
        }
      } else {
        console.warn('Found code blocks but could not extract valid Manim code');
      }
    } else {
      console.warn('No Manim code blocks found in the response');
      // If no code blocks found, try to extract any Python code that looks like Manim
      const pythonCodeMatch = assistantMessage.match(/(class\s+\w+\s*\([\s\S]*?Scene\)[\s\S]*?def\s+construct\([\s\S]*?def\s+\w+\s*\([\s\S]*?\).*?\{[\s\S]*?\})/);
      if (pythonCodeMatch) {
        manimCode = pythonCodeMatch[1].trim();
        console.log('Extracted Manim code from raw text (first 200 chars):', manimCode.substring(0, 200) + '...');
      }
    }

    return {
      success: true,
      solution,
      manimCode,
      visualizationDescription
    };
    } catch (error: any) {
      console.error('Error in Azure OpenAI processing:', error);
      if (error?.message && error.message.includes('does not support vision')) {
        return {
          success: false,
          solution: "Error: Your Azure OpenAI deployment (" + deploymentName + ") does not support vision capabilities. Please use a GPT-4 Vision model.",
          manimCode: "",
          visualizationDescription: "",
          error: "Vision capabilities not supported"
        };
      }
      throw error;
    }
    
  } catch (error) {
    console.error('Error processing with Azure OpenAI:', error);
    throw error;
  }
}

async function validateAndProcessRequest(request: NextRequest): Promise<ProcessResponse> {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const problemText = formData.get('problemText') as string | null;
  
  // Validate input
  if (!file && !problemText?.trim()) {
    return {
      success: false,
      solution: '',
      manimCode: '',
      error: 'Either a file or problem text is required'
    };
  }
  
  // Handle file upload if present
  if (file) {
    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        success: false,
        solution: '',
        manimCode: '',
        error: `Unsupported file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`
      };
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        solution: '',
        manimCode: '',
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      };
    }
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    try {
      // Create uploads directory if it doesn't exist
      const uploadDir = join(process.cwd(), UPLOAD_DIR);
      await mkdir(uploadDir, { recursive: true });
      
      // Save the file with a unique name
      const uniqueId = uuidv4();
      const filename = `${uniqueId}-${file.name.replace(/[^\w.]+/g, '-')}`;
      const filepath = join(uploadDir, filename);
      await writeFile(filepath, buffer);
      
      // Add context about the file type to help the AI
      const fileContext = `This is a ${file.type} file containing a STEM problem that needs to be solved and visualized.`;
      const combinedText = problemText?.trim() 
        ? `${fileContext}\n\n${problemText}` 
        : fileContext;
      
      // Process with Azure OpenAI (uses GPT-4 Vision for images/PDFs)
      return {
        ...(await processWithAzureOpenAI(combinedText, buffer)),
        success: true
      };
      
    } catch (error) {
      console.error('Error processing file:', error);
      return {
        success: false,
        solution: '',
        manimCode: '',
        error: 'Failed to process the uploaded file'
      };
    }
  } else {
    // Process text-only problem
    try {
      return {
        ...(await processWithAzureOpenAI(problemText!.trim())),
        success: true
      };
    } catch (error) {
      console.error('Error processing text problem:', error);
      return {
        success: false,
        solution: '',
        manimCode: '',
        error: 'Failed to process the problem text'
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
        visualizationDescription: result.visualizationDescription,
        error: undefined // Explicitly set to undefined to match the type
      } as ProcessResponse);
    } else {
      // Return error response with 400 status
      const errorResponse: ProcessResponse = {
        success: false,
        solution: '',
        manimCode: '',
        error: result.error || 'Failed to process the problem'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
  } catch (error) {
    // Log the full error for debugging
    console.error('Unexpected error in process-problem endpoint:', error);
    
    // Return a user-friendly error response
    const errorResponse: ProcessResponse = {
      success: false,
      solution: '',
      manimCode: '',
      error: 'An unexpected error occurred while processing your request',
      ...(process.env.NODE_ENV === 'development' && {
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
