import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { originalProblem } = await request.json();

    if (!originalProblem?.trim()) {
      return NextResponse.json({ problems: [] });
    }

    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

    if (!apiKey || !endpoint || !deploymentName) {
      return NextResponse.json({ problems: [] });
    }

    const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

    const payload = {
      messages: [
        {
          role: 'system',
          content:
            'You are a math tutor. Your job is to generate practice problems. Return ONLY a valid JSON array of exactly 3 strings — no explanation, no markdown, no code fences. Each string is one practice problem similar in topic and difficulty to the given problem. Example output: ["Solve for x: 3x + 2 = 11", "Solve for x: 5x - 4 = 6", "Solve for x: 2x + 7 = 15"]',
        },
        {
          role: 'user',
          content: `Generate 3 practice problems similar to: "${originalProblem}". Return only a JSON array of 3 strings.`,
        },
      ],
      max_completion_tokens: 300,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return NextResponse.json({ problems: [] });
    }

    const data = await response.json();
    const content: string = data.choices[0]?.message?.content || '[]';

    // Extract JSON array from the response (handles surrounding text)
    let problems: string[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        problems = JSON.parse(jsonMatch[0]);
      }
    } catch {
      problems = [];
    }

    // Sanitize: keep only non-empty strings, max 3
    problems = problems
      .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      .slice(0, 3);

    return NextResponse.json({ problems });

  } catch {
    return NextResponse.json({ problems: [] });
  }
}
