export type ChatImage = {
  base64: string;
  mimeType: string;
  uri: string;
  fileName?: string | null;
};

export type ChatMessage = {
  id: string;
  image?: ChatImage;
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
You are Ribbon, the friendly mascot health companion inside Diabeto, a diabetes prevention app.
Use a warm, supportive, professional tone. Sound like a caring guide, not a generic chatbot.
Be practical, specific, and concise.
Give advice about balanced meals, portions, food swaps, exercise, weight, sleep, glucose checks, and risk reduction.
When asked about meals, suggest realistic breakfast, lunch, dinner, or snack options with diabetes-prevention reasoning.
If health data is provided, use it to personalize the answer and mention the most relevant factor briefly.
If the user attaches an image, describe only visible food, drink, label, or health-related details and connect them to diabetes prevention.
Do not diagnose diabetes or prescribe medication.
If symptoms sound urgent, advise the user to seek medical care.
Remember useful preferences or prior goals from the conversation history, but do not claim to remember anything outside the provided chat history.
When helpful, refer to yourself as Ribbon in first person, but do not overdo it.
Keep replies clear and under 120 words unless the user asks for a full meal plan.
`;

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';
const EXPO_PUBLIC_GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const EXPO_PUBLIC_GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL;

export async function sendDiabetoChat(messages: ChatMessage[], healthContext?: string | null) {
  const apiKey = EXPO_PUBLIC_GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      'Gemini API key is missing. Add EXPO_PUBLIC_GEMINI_API_KEY to .env and restart Expo.'
    );
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${getGeminiModel()}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(buildGeminiRequest(messages, healthContext ?? null)),
    }
  );

  const data = (await response.json()) as GeminiResponse;

  if (!response.ok) {
    throw new Error(cleanGeminiError(data.error?.message ?? 'Gemini could not answer right now.'));
  }

  return extractText(data);
}

function buildGeminiRequest(messages: ChatMessage[], healthContext: string | null): GeminiRequest {
  const firstUserIndex = messages.findIndex((message) => message.role === 'user');
  const relevantMessages = (firstUserIndex >= 0 ? messages.slice(firstUserIndex) : messages).slice(-12);

  const contents = relevantMessages
    .filter((message) => message.role === 'user' || message.role === 'bot')
    .map<GeminiContent>((message) => ({
      role: message.role === 'bot' ? 'model' : 'user',
      parts: buildGeminiParts(message),
    }))
    .filter((content) => content.parts.length > 0);

  const firstUserMessage = contents.find((content) => content.role === 'user');

  if (firstUserMessage) {
    firstUserMessage.parts.unshift({
      text: [
        SYSTEM_PROMPT.trim(),
        healthContext
          ? `Provided health data:\n${healthContext.trim().slice(0, 1200)}`
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

function buildGeminiParts(message: ChatMessage): GeminiPart[] {
  const text = String(message.text ?? '').trim();
  const parts: GeminiPart[] = text ? [{ text }] : [];

  if (message.role === 'user' && message.image?.base64 && message.image.mimeType.startsWith('image/')) {
    parts.push({
      inline_data: {
        data: message.image.base64,
        mime_type: message.image.mimeType,
      },
    });
  }

  return parts;
}

function extractText(data: GeminiResponse) {
  const text = data.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text)
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('I could not create a reply. Please try asking in a different way.');
  }

  return text;
}

function cleanGeminiError(message: string) {
  if (message.toLowerCase().includes('api key not valid')) {
    return 'Gemini says this API key is not valid. Check EXPO_PUBLIC_GEMINI_API_KEY in .env, then restart Expo.';
  }

  if (message.toLowerCase().includes('quota')) {
    return 'Gemini quota is not available for this model right now. Try again later or change EXPO_PUBLIC_GEMINI_MODEL in .env.';
  }

  return message;
}

function getGeminiModel() {
  return (EXPO_PUBLIC_GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL).replace(/^models\//, '');
}
