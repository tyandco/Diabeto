import { getRibbonToneInstruction, type RibbonTone } from '@/lib/app-preferences';

export type ChatImage = {
  base64: string;
  mimeType: string;
  previewBase64?: string;
  previewMimeType?: string;
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
    finishReason?: string;
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
export async function sendDiabetoChat(
  messages: ChatMessage[],
  healthContext?: string | null,
  ribbonTone: RibbonTone = 'warm',
  dailyLogContext?: string | null,
  geminiApiKey?: string | null
) {
  const apiKey = geminiApiKey?.trim();

  if (!apiKey) {
    throw new Error(
      'Add your Gemini API key in Settings before chatting with Ribbon.'
    );
  }

  const requestBody = JSON.stringify(
    buildGeminiRequest(messages, healthContext ?? null, ribbonTone, dailyLogContext ?? null)
  );
  let lastError = 'Gemini could not answer right now.';

  const result = await fetchGemini(apiKey, requestBody);

  if (result.ok) {
    const text = extractText(result.data);
    const finishReason = getFinishReason(result.data);

    if (finishReason === 'MAX_TOKENS' || isLikelyIncompleteReply(text)) {
      return `${text}\n\n[Gemini may have cut this off. Send "continue" if you want the rest.]`;
    }

    if (finishReason && finishReason !== 'STOP') {
      return `${text}\n\n[Gemini stopped early: ${finishReason}]`;
    }

    return text;
  }

  lastError = result.data.error?.message ?? lastError;
  throw new Error(cleanGeminiError(lastError));
}

async function fetchGemini(apiKey: string, requestBody: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${getGeminiModel()}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: requestBody,
    }
  );

  return {
    data: (await response.json()) as GeminiResponse,
    ok: response.ok,
  };
}

function buildGeminiRequest(
  messages: ChatMessage[],
  healthContext: string | null,
  ribbonTone: RibbonTone,
  dailyLogContext: string | null
): GeminiRequest {
  const firstUserIndex = messages.findIndex((message) => message.role === 'user');
  const relevantMessages = (firstUserIndex >= 0 ? messages.slice(firstUserIndex) : messages).slice(-8);

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
        getRibbonToneInstruction(ribbonTone),
        `Current date: ${formatCurrentDateForAI()}`,
        healthContext
          ? `Health: ${healthContext.trim().slice(0, 500)}`
          : 'No health data was provided by the app yet.',
        dailyLogContext
          ? `Recent logs:\n${dailyLogContext.trim().slice(0, 700)}`
          : 'No daily log history was provided by the app yet.',
        'Use any attached image if present.',
      ].join('\n\n'),
    });
  }

  return {
    contents,
    generationConfig: {
      maxOutputTokens: 260,
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

function getFinishReason(data: GeminiResponse) {
  return data.candidates?.[0]?.finishReason ?? null;
}

function isLikelyIncompleteReply(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return false;
  }

  if (/[.!?)]$/.test(trimmed)) {
    return false;
  }

  if (/['"`:,;(-]$/.test(trimmed)) {
    return true;
  }

  const lastWord = trimmed.split(/\s+/).at(-1)?.toLowerCase().replace(/[^a-z]/g, '');
  return Boolean(
    lastWord &&
      [
        'a',
        'an',
        'and',
        'are',
        'as',
        'but',
        'for',
        'from',
        'if',
        'in',
        'into',
        'is',
        'of',
        'or',
        'that',
        'the',
        'to',
        'what',
        'whats',
        'when',
        'where',
        'which',
        'who',
        'with',
        'your',
      ].includes(lastWord)
  );
}

function cleanGeminiError(message: string) {
  if (message.toLowerCase().includes('api key not valid')) {
    return 'Gemini says this API key is not valid. Check the Gemini API key saved in Settings.';
  }

  if (message.toLowerCase().includes('quota')) {
    const retrySeconds = getRetrySeconds(message);

    if (retrySeconds) {
      return `Gemini hit a short rate limit. Wait about ${retrySeconds} seconds, then send again.`;
    }

    if (message.toLowerCase().includes('limit: 0')) {
      return 'Gemini has no free quota available for this model/key right now. Try again after the daily reset, enable billing, or switch API keys.';
    }

    return 'Gemini quota is not available right now. Wait a few minutes, then try again.';
  }

  return message;
}

function isQuotaError(message: string) {
  const lowerMessage = message.toLowerCase();
  return lowerMessage.includes('quota') || lowerMessage.includes('rate limit');
}

function getRetrySeconds(message: string) {
  const match = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);

  if (!match) {
    return null;
  }

  return Math.ceil(Number(match[1]));
}

function getGeminiModel() {
  return DEFAULT_GEMINI_MODEL;
}

function formatCurrentDateForAI() {
  return new Date().toLocaleString([], {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  });
}
