import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Azure OpenAI integration
async function processWithAzureOpenAI(text: string, imageBuffer?: Buffer) {
  try {
    // Extract environment variables
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2023-05-15';

    if (!apiKey || !endpoint || !deploymentName) {
      console.warn('Azure OpenAI credentials not properly configured, using mock response');
      return getMockResponse();
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
          content: "You are a helpful STEM tutor specializing in visual explanations. Your task has three parts:\n\n1. Use OCR to read and understand any text in the uploaded image or PDF.\n2. Analyze the STEM problem and provide a clear, step-by-step solution.\n3. Create a detailed description of how to visualize this solution, followed by Python code using the Manim library that implements this visualization.\n\nFor the visualization:\n- First describe in natural language what the animation should show and how it should progress\n- Then provide well-commented Manim code that implements this visualization\n- Ensure the visualization illustrates the key concepts in the problem\n- Use appropriate colors, labels, and animations to make the explanation clear"
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
    const assistantMessage = data.choices[0].message.content;
    
    // Parse the response to extract solution text, visualization description, and Manim code
    let solution = assistantMessage;
    let manimCode = '';
    let visualizationDescription = '';
    
    // Extract Manim code - look for the last Python code block as it's likely the final implementation
    const manimCodeMatches = [...assistantMessage.matchAll(/```(?:python|manim)([\s\S]*?)```/g)];
    console.log(`Found ${manimCodeMatches.length} code blocks in the response`);
    
    if (manimCodeMatches.length > 0) {
      // Get the last code block
      const lastMatch = manimCodeMatches[manimCodeMatches.length - 1];
      manimCode = lastMatch[1].trim();
      console.log('Extracted Manim code:', manimCode.substring(0, 100) + '...');
      
      // Remove all code blocks from the solution text
      solution = assistantMessage;
      for (const match of manimCodeMatches) {
        solution = solution.replace(match[0], '');
      }
      solution = solution.trim();
      
      // Try to extract the visualization description - look for sections with keywords
      const visualizationKeywords = ['visualization', 'animation', 'visual explanation', 'manim'];
      const paragraphs = solution.split('\n\n');
      
      for (const paragraph of paragraphs) {
        const lowerParagraph = paragraph.toLowerCase();
        if (visualizationKeywords.some(keyword => lowerParagraph.includes(keyword))) {
          visualizationDescription = paragraph;
          break;
        }
      }
    }

    return {
      solution,
      manimCode,
      visualizationDescription
    };
    } catch (error: any) {
      console.error('Error in Azure OpenAI processing:', error);
      if (error?.message && error.message.includes('does not support vision')) {
        return {
          solution: "Error: Your Azure OpenAI deployment (" + deploymentName + ") does not support vision capabilities. Please use a GPT-4 Vision model.",
          manimCode: "",
          visualizationDescription: ""
        };
      }
      return getMockResponse();
    }
    
  } catch (error) {
    console.error('Error processing with Azure OpenAI:', error);
    // Return mock response as fallback
    return getMockResponse();
  }
}

// Mock response for testing or when Azure OpenAI is not configured
function getMockResponse() {
  return {
    solution: "Here's a step-by-step solution to your problem...\n\nStep 1: Understand the problem statement\nStep 2: Identify the key variables\nStep 3: Apply the relevant formula\nStep 4: Solve for the unknown variable",
    visualizationDescription: "The visualization will illustrate Newton's Second Law of Motion (F = ma). It will start with the equation appearing on screen, followed by a visual representation of how force, mass, and acceleration relate to each other. The animation will show how changing one variable affects the others.",
    manimCode: `
from manim import *

class SolutionAnimation(Scene):
    def construct(self):
        # This is a placeholder for the actual Manim code that would be generated
        title = Text("Solution Visualization")
        self.play(Write(title))
        self.wait(1)
        self.play(FadeOut(title))
        
        # Example equation
        equation = MathTex("F = ma")
        self.play(Write(equation))
        self.wait(2)
        
        # Example explanation
        explanation = Text("Newton's Second Law of Motion", font_size=24)
        explanation.next_to(equation, DOWN)
        self.play(Write(explanation))
        self.wait(2)
        
        # Visual representation of the relationship
        arrow_right = Arrow(LEFT, RIGHT, color=BLUE)
        arrow_right.next_to(equation, DOWN, buff=1)
        mass_text = Text("Mass", color=GREEN).next_to(arrow_right, LEFT)
        force_text = Text("Force", color=RED).next_to(arrow_right, RIGHT)
        
        self.play(Create(arrow_right), Write(mass_text), Write(force_text))
        self.wait(2)
    `
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const problemText = formData.get('problemText') as string | null;
    
    if (!file && !problemText) {
      return NextResponse.json(
        { error: 'Either a file or problem text is required' },
        { status: 400 }
      );
    }

    let result;
    
    // Handle file upload (image or PDF)
    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Create uploads directory if it doesn't exist
      const uploadDir = join(process.cwd(), 'uploads');
      try {
        await mkdir(uploadDir, { recursive: true });
      } catch (error) {
        console.error('Error creating upload directory:', error);
      }
      
      // Generate unique filename
      const uniqueId = uuidv4();
      const filename = `${uniqueId}-${file.name}`;
      const filepath = join(uploadDir, filename);
      
      // Save the file
      await writeFile(filepath, buffer);
      
      // Determine file type and handle accordingly
      const fileType = file.type.toLowerCase();
      let fileText = '';
      
      // For PDF files, we should ideally extract text, but that would require additional libraries
      // For now, we'll send the raw buffer and let Azure OpenAI handle it with its vision capabilities
      // In a production environment, you might want to use a PDF parsing library
      
      // Add context about the file type to help the AI
      const fileContext = `This is a ${fileType} file containing a STEM problem that needs to be solved and visualized.`;
      const combinedText = problemText ? `${fileContext}\n\n${problemText}` : fileContext;
      
      // Process with Azure OpenAI (this will use GPT-4 Vision for OCR)
      result = await processWithAzureOpenAI(combinedText, buffer);
    } else if (problemText) {
      // Process text-only problem
      result = await processWithAzureOpenAI(problemText);
    }
    
    return NextResponse.json({ 
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Error processing problem:', error);
    return NextResponse.json(
      { error: 'Error processing your problem' },
      { status: 500 }
    );
  }
}
