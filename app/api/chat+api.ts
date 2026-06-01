type ClientMessage = {
  image?: {
    base64: string;
    fileName?: string | null;
    mimeType: string;
  };
  role: 'bot' | 'user';
  text: string;
};

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
  }[];
  error?: {
    message?: string;
  };
};

type GeminiErrorResponse = {
  error?: {
    message?: string;
  };
};

type GeminiContent = {
  role: 'user' | 'model';
  parts: GeminiPart[];
};

type GeminiPart =
  | {
      text: string;
    }
  | {
      inline_data: {
        data: string;
        mime_type: string;
      };
    };

type GeminiRequest = {
  contents: GeminiContent[];
  generationConfig: {
    maxOutputTokens: number;
    temperature: number;
  };
};

const SYSTEM_PROMPT = `
You are DiabetoBot, a helpful diabetes prevention chatbot inside an educational app.
Give short, practical advice about food, exercise, weight, sleep, glucose checks, and risk reduction.
If health data is provided, use it to personalize the answer and mention the most relevant factor briefly.
If the user attaches an image, describe only visible food, drink, label, or health-related details and connect them to diabetes prevention.
Do not diagnose diabetes or prescribe medication.
If symptoms sound urgent, advise the user to seek medical care.
Keep replies friendly, clear, and under 120 words.
`;

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';

export async function POST(request: Request) {
  try {
    const apiKey = getGeminiKey();

    if (!apiKey) {
      return Response.json(
        {
          error:
            'Gemini API key is missing. Add GEMINI_API_KEY to your environment and restart Expo.',
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as { healthContext?: string | null; messages?: ClientMessage[] };
    const messages = sanitizeMessages(body.messages);
    const healthContext = sanitizeHealthContext(body.healthContext);

    if (messages.length === 0) {
      return Response.json({ error: 'Send at least one chat message.' }, { status: 400 });
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${getGeminiModel()}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(buildGeminiRequest(messages, healthContext)),
      }
    );

    const data = (await geminiResponse.json()) as GeminiResponse | GeminiErrorResponse;

    if (!geminiResponse.ok) {
      const message = data.error?.message ?? 'Gemini could not answer right now.';

      return Response.json(
        { error: cleanGeminiError(message) },
        { status: geminiResponse.status }
      );
    }

    return Response.json({ reply: extractText(data as GeminiResponse) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unexpected chatbot error.' },
      { status: 500 }
    );
  }
}

function buildGeminiRequest(messages: ClientMessage[], healthContext: string | null): GeminiRequest {
  const contents = messages
    .slice(messages.findIndex((message) => message.role === 'user'))
    .map<GeminiContent>((message) => ({
      role: message.role === 'bot' ? 'model' : 'user',
      parts: buildGeminiParts(message),
    }));

  const firstUserMessage = contents.find((content) => content.role === 'user');

  if (firstUserMessage) {
    firstUserMessage.parts.unshift({
      text: [
        SYSTEM_PROMPT.trim(),
        healthContext
          ? `Provided health data:\n${healthContext}`
          : 'No health data was provided by the app yet.',
        'Use any attached image if present.',
      ].join('\n\n'),
    });
  }

  return {
    contents,
    generationConfig: {
      maxOutputTokens: 220,
      temperature: 0.7,
    },
  };
}

function buildGeminiParts(message: ClientMessage): GeminiPart[] {
  const parts: GeminiPart[] = [{ text: message.text }];

  if (message.role === 'user' && message.image?.base64) {
    parts.push({
      inline_data: {
        data: message.image.base64,
        mime_type: message.image.mimeType,
      },
    });
  }

  return parts;
}

function sanitizeMessages(messages: ClientMessage[] | undefined) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message) => message.role === 'user' || message.role === 'bot')
    .map((message) => ({
      image: sanitizeImage(message.image),
      role: message.role,
      text: String(message.text ?? '').trim(),
    }))
    .filter((message) => message.text.length > 0)
    .slice(-12);
}

function sanitizeImage(image: ClientMessage['image']) {
  if (!image?.base64 || !image.mimeType?.startsWith('image/')) {
    return undefined;
  }

  return {
    base64: String(image.base64),
    fileName: image.fileName,
    mimeType: image.mimeType,
  };
}

function sanitizeHealthContext(healthContext: string | null | undefined) {
  if (!healthContext) {
    return null;
  }

  return String(healthContext).trim().slice(0, 1200) || null;
}

function extractText(data: GeminiResponse) {
  const text = data.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text)
    .filter(Boolean)
    .join('\n')
    .trim();

  return text || 'I could not create a reply. Please try asking in a different way.';
}

function cleanGeminiError(message: string) {
  if (message.toLowerCase().includes('quota')) {
    return 'Gemini quota is not available for this model right now. Try again later or change GEMINI_MODEL in .env.';
  }

  return message;
}

function getGeminiKey() {
  return (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.GEMINI_API_KEY;
}

function getGeminiModel() {
  const model = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.GEMINI_MODEL;

  return (model ?? DEFAULT_GEMINI_MODEL).replace(/^models\//, '');
}
