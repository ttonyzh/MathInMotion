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
    
    // Call the Python backend to render the visualization
    const response = await fetch('http://localhost:5001/render-manim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ manimCode }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Rendering failed:', errorData);
      throw new Error(`Visualization rendering failed: ${JSON.stringify(errorData)}`);
    }
    
    const result = await response.json();
    console.log('Render result:', result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error rendering Manim animation:', error);
    return NextResponse.json(
      { error: 'Failed to render Manim animation' },
      { status: 500 }
    );
  }
}
