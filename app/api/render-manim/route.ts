import { NextRequest, NextResponse } from 'next/server';

// Define types for better type safety
interface RenderRequest {
  manimCode: string;
}

interface RenderResponse {
  success: boolean;
  videoBase64?: string;
  textFallback?: boolean;
  message?: string;
  error?: string;
}

const RENDER_TIMEOUT_MS = 60000; // 60 seconds
const BACKEND_URL = 'http://localhost:5005/render-manim';

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request
    const data: Partial<RenderRequest> = await request.json();
    const { manimCode } = data;
    
    if (!manimCode?.trim()) {
      return NextResponse.json(
        { error: 'No Manim code provided' },
        { status: 400 }
      );
    }
    
    console.log('Sending Manim code to backend for rendering...');
    
    // Call the Python backend to render the Manim visualization
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS);
    
    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manimCode }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Backend returned ${response.status}`);
      }
      
      const result: RenderResponse = await response.json();
      
      // Log appropriate success message
      if (result.success) {
        if (result.textFallback) {
          console.log('Rendering fallback to text');
        } else if (result.videoBase64) {
          console.log(`Rendering successful (${result.videoBase64.length} chars)`);
        }
      } else {
        console.error('Backend returned error:', result.error);
      }
      
      return NextResponse.json(result);
      
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Rendering timed out');
        }
      }
      throw error;
    }
    
  } catch (error) {
    console.error('Error in render-manim endpoint:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to render animation',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
