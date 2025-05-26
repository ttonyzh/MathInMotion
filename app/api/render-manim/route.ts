import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { manimCode } = data;
    
    if (!manimCode) {
      return NextResponse.json(
        { error: 'No Manim code provided' },
        { status: 400 }
      );
    }
    
    console.log('Sending Manim code to backend for rendering...');
    
    // Call the Python backend to render the Manim visualization
    const response = await fetch('http://localhost:5004/render-manim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ manimCode }),
      // Increase timeout for Manim rendering which can take time
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Manim rendering failed:', errorData);
      throw new Error(`Manim rendering failed: ${JSON.stringify(errorData)}`);
    }
    
    const result = await response.json();
    
    // Log success but not the entire base64 string which would be too large
    if (result.success) {
      if (result.textFallback) {
        console.log('Received text fallback response instead of video');
        console.log('Message:', result.message);
      } else if (result.videoBase64) {
        console.log('Manim rendering successful, video received');
        console.log(`Received base64 video (${result.videoBase64.length} chars)`);
      } else {
        console.log('Manim rendering successful but no video data received');
      }
    } else {
      console.error('Manim rendering returned error:', result.error);
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error rendering Manim animation:', error);
    return NextResponse.json(
      { error: 'Failed to render Manim animation', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
