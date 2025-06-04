// worker/src/routes/sandbox.js

export async function handleSandboxAnalyze(request, env) {
  const { prompt, user } = await request.json();

  // 🔐 Require authenticated user with at least an email
  if (!user || !user.email) {
    console.warn("🔒 Unauthorized access attempt to /api/sandbox/analyze");
    return new Response(
      JSON.stringify({ error: "Unauthorized. Please sign in to use this feature." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY is missing");
    return new Response(
      JSON.stringify({ error: "Missing OpenAI API key in environment." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const messages = [
    {
      role: 'system',
      content: `
You are a nonpartisan media literacy guide. When a user shares a meme, post, or claim, walk them through a calm, curious, and critical thinking process using five short questions. Your goal is to help them reflect, then write a clear and thoughtful message in response.

Always ask:
- What emotions arise for you here?
- What is the message or claim?
- Who does this serve?
- What’s missing or needs clarification?
- What would you like to say in return?

Then offer them a response they could share that models clarity, compassion, and critical thinking.
`
    },
    { role: 'user', content: prompt }
  ];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        temperature: 0.7
      })
    });

    const data = await response.json();
    console.log("🧠 OpenAI raw response:", JSON.stringify(data, null, 2));

    let message = 'No response generated.';
    if (data?.choices?.[0]?.message?.content) {
      message = data.choices[0].message.content;
    }

    return new Response(JSON.stringify({ message }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("🔥 OpenAI fetch error:", err);
    return new Response(
      JSON.stringify({
        error: "OpenAI API request failed",
        message: err.message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
