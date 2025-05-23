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
          content: "You are a helpful STEM tutor. Analyze the problem provided and give a step-by-step solution. Then, provide Python code using the Manim library to create a visual animation explaining the solution."
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
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Azure OpenAI API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    // Extract the solution text and Manim code from the response
    const assistantMessage = data.choices[0].message.content;
    
    // Simple parsing to separate the solution text from the Manim code
    // This assumes the Manim code is enclosed in ```python and ``` markers
    let solution = assistantMessage;
    let manimCode = '';
    
    const manimCodeMatch = assistantMessage.match(/```python([\s\S]*?)```/);
    if (manimCodeMatch && manimCodeMatch[1]) {
      manimCode = manimCodeMatch[1].trim();
      // You might want to clean up the solution text by removing the code block
      solution = assistantMessage.replace(/```python[\s\S]*?```/, '').trim();
    }

    return {
      solution,
      manimCode
    };
    
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
      
      // Process with Azure OpenAI (this would include OCR for images/PDFs)
      result = await processWithAzureOpenAI(problemText || '', buffer);
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
