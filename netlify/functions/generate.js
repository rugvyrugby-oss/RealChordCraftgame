exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  console.log("Function invoked");
  console.log("API key present:", !!process.env.ANTHROPIC_API_KEY);

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Missing ANTHROPIC_API_KEY env var",
        content: [{ type: "text", text: '{"title":"Fallback","key":"C major","bpm":80,"timeSignature":"4/4","style":"lofi","chords":[{"name":"Cmaj7","notes":["C3","E3","G3","B3"]},{"name":"Am7","notes":["A2","C3","E3","G3"]},{"name":"Fmaj7","notes":["F2","A2","C3","E3"]},{"name":"G7","notes":["G2","B2","D3","F3"]}]}' }],
      }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    console.log("Calling Anthropic with model:", body.model);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    console.log("Anthropic status:", res.status);
    console.log("Anthropic response (first 300):", text.substring(0, 300));

    if (!res.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          content: [{ type: "text", text: '{"title":"Fallback","key":"C major","bpm":80,"timeSignature":"4/4","style":"lofi","chords":[{"name":"Cmaj7","notes":["C3","E3","G3","B3"]},{"name":"Am7","notes":["A2","C3","E3","G3"]},{"name":"Fmaj7","notes":["F2","A2","C3","E3"]},{"name":"G7","notes":["G2","B2","D3","F3"]}]}' }],
          _debug: { upstreamStatus: res.status, upstreamBody: text.substring(0, 500) },
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: text,
    };
  } catch (e) {
    console.log("Caught error:", e.message);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        content: [{ type: "text", text: '{"title":"Fallback","key":"C major","bpm":80,"timeSignature":"4/4","style":"lofi","chords":[{"name":"Cmaj7","notes":["C3","E3","G3","B3"]},{"name":"Am7","notes":["A2","C3","E3","G3"]},{"name":"Fmaj7","notes":["F2","A2","C3","E3"]},{"name":"G7","notes":["G2","B2","D3","F3"]}]}' }],
        _debug: { error: e.message },
      }),
    };
  }
};
