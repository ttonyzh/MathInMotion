import { NextRequest, NextResponse } from 'next/server';

// Define types for better type safety
interface RenderRequest { //the request coming in
  manimCode: string;
}

interface RenderResponse { //the response of the AI 
  success: boolean;
  videoBase64?: string;
  textFallback?: boolean;
  message?: string;
  error?: string;
}

const RENDER_TIMEOUT_MS = 60000; // 60 seconds
const BACKEND_URL = 'http://localhost:5005/render-manim';

export async function POST(request: NextRequest) {
  let controller: AbortController | null = null;
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    // Parse and validate request
    const data: Partial<RenderRequest> = await request.json(); // the request coming in
    const manimCode = data.manimCode;
    
    if (!manimCode?.trim()) {
      return NextResponse.json(
        { error: 'No Manim code provided' },
        { status: 400 }
      );
    }
    
    console.log('Sending Manim code to backend for rendering...');
    
    // Setup timeout
    controller = new AbortController();
    timeoutId = setTimeout(() => controller!.abort(), RENDER_TIMEOUT_MS);
    
    const response: Response = await fetch(BACKEND_URL, { //sends the request to the backend, localhost:5005. Sends this code to the manim server and it outputs an image or video
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manimCode }), //changes raw manim code into a json string. We need the curly braces because we are sending a json object.
      signal: controller.signal, //connecting the abortController to the fetch request
    });
    
    clearTimeout(timeoutId); //makes sure timeout is cleared
    timeoutId = null; //makes sure timeout is cleared
    
    if (!response.ok) { //the response is not ok. meaning there is a 400-500 error
      const errorData = await response.json().catch(() => ({})); //tries to parse the response as json. If it fails, it returns an empty object.
      throw new Error(errorData.error || `Backend returned ${response.status}`); //throws an error with the error message or the status code
    }
    
    const result: RenderResponse = await response.json(); //tries to parse the response as json
    
    // Log appropriate success message
    if (result.success) {
      if (result.textFallback) {
        console.log('Rendering fallback to text. There could be a problem with the Cairo library');
      } else if (result.videoBase64) {
        console.log(`Rendering successful (${result.videoBase64.length} chars)`);
      }
    } else { //the backend reported an error in the response body
      console.error('Backend returned error:', result.error);
    }
    
    return NextResponse.json(result);
    
  } catch (error: unknown) {
    // Cleanup timeout if it's still pending
    if (timeoutId) clearTimeout(timeoutId);
    
    // Handle specific error types
    if (error instanceof Error) {
      let errorMessage: string;
      if (error.name === 'AbortError') { //if the error is caused by the timeout, set the error message to "Rendering timed out after 60 seconds"
        errorMessage = 'Rendering timed out after 60 seconds';
      } else {
        errorMessage = error.message; //else set the error message to the error message
      }
      console.error('Error in render-manim endpoint:', error); //log the error
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to render animation1',
          message: errorMessage
        },
        { status: 500 }
      );
    }
    
    // For non-Error throws. Catches any unexpected errors
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to render animation',
        message: 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}
