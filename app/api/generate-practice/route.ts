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
            'You are a math tutor. Your job is to generate practice problems. Return ONLY a valid JSON array of exactly 3 strings — no explanation, no markdown, no code fences. Each string is one practice problem similar in topic and difficulty to the given problem. CRITICAL: Never use the ^ caret for exponents. Always use Unicode superscripts: x² x³ x⁴ x⁵ x⁶ x⁷ x⁸ x⁹. Example output: ["Solve for x: 3x + 2 = 11", "Find the derivative of f(x) = 4x³ - 2x²", "Evaluate: ∫(3x² + 1)dx"]',
        },
        {
          role: 'user',
          content: `Generate 3 practice problems similar to: "${originalProblem}". Return only a JSON array of 3 strings.`,
        },
      ],
      max_completion_tokens: 1500,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error('[generate-practice] API error:', response.status, errText);
      return NextResponse.json({ problems: [] });
    }

    const data = await response.json();
    const content: string = data.choices[0]?.message?.content || data.choices[0]?.message?.reasoning_content || '[]';

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

  } catch (err) {
    console.error('[generate-practice] caught error:', err);
    return NextResponse.json({ problems: [] });
  }
}
