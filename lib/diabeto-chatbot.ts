import { getRibbonToneInstruction, type RibbonTone } from '@/lib/app-preferences';

type ChatLanguage = 'en' | 'ar';

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
  geminiApiKey?: string | null,
  language: ChatLanguage = 'en'
) {
  const apiKey = geminiApiKey?.trim();

  if (!apiKey) {
    throw new Error(chatErrors[language].missingKey);
  }

  const requestBody = JSON.stringify(
    buildGeminiRequest(messages, healthContext ?? null, ribbonTone, dailyLogContext ?? null)
  );
  let lastError = chatErrors[language].genericGeminiFailure;

  const result = await fetchGemini(apiKey, requestBody);

  if (result.ok) {
    const text = extractText(result.data);
    const finishReason = getFinishReason(result.data);

    if (finishReason === 'MAX_TOKENS' || isLikelyIncompleteReply(text)) {
      return `${text}\n\n${chatErrors[language].cutOff}`;
    }

    if (finishReason && finishReason !== 'STOP') {
      return `${text}\n\n${chatErrors[language].stoppedEarly(finishReason)}`;
    }

    return text;
  }

  lastError = result.data.error?.message ?? lastError;
  throw new Error(cleanGeminiError(lastError, language));
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
    throw new Error(chatErrors.en.noReply);
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

function cleanGeminiError(message: string, language: ChatLanguage) {
  const errors = chatErrors[language];

  if (message.toLowerCase().includes('api key not valid')) {
    return errors.invalidKey;
  }

  if (message.toLowerCase().includes('quota')) {
    const retrySeconds = getRetrySeconds(message);

    if (retrySeconds) {
      return errors.shortRateLimit(retrySeconds);
    }

    if (message.toLowerCase().includes('limit: 0')) {
      return errors.noFreeQuota;
    }

    return errors.quotaUnavailable;
  }

  return message;
}

function getRetrySeconds(message: string) {
  const match = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);

  if (!match) {
    return null;
  }

  return Math.ceil(Number(match[1]));
}

const chatErrors = {
  en: {
    cutOff: '[Gemini may have cut this off. Send "continue" if you want the rest.]',
    genericGeminiFailure: 'Gemini could not answer right now.',
    invalidKey: 'Gemini says this API key is not valid. Check the Gemini API key saved in Settings.',
    missingKey: 'Add your Gemini API key in Settings before chatting with Ribbon.',
    noFreeQuota:
      'Gemini has no free quota available for this model/key right now. Try again after the daily reset, enable billing, or switch API keys.',
    noReply: 'I could not create a reply. Please try asking in a different way.',
    quotaUnavailable: 'Gemini quota is not available right now. Wait a few minutes, then try again.',
    shortRateLimit: (seconds: number) =>
      `Gemini hit a short rate limit. Wait about ${seconds} seconds, then send again.`,
    stoppedEarly: (reason: string) => `[Gemini stopped early: ${reason}]`,
  },
  ar: {
    cutOff: '[ربما قطع Gemini الرد. أرسل "تابع" إذا أردت الباقي.]',
    genericGeminiFailure: 'لا يستطيع Gemini الرد الآن.',
    invalidKey: 'يقول Gemini إن مفتاح API غير صالح. تحقق من مفتاح Gemini API المحفوظ في الإعدادات.',
    missingKey: 'أضف مفتاح Gemini API في الإعدادات قبل الدردشة مع Ribbon.',
    noFreeQuota:
      'لا توجد حصة مجانية متاحة من Gemini لهذا النموذج أو المفتاح الآن. حاول بعد إعادة التعيين اليومية، أو فعّل الفوترة، أو بدّل مفتاح API.',
    noReply: 'لم أتمكن من إنشاء رد. حاول السؤال بطريقة مختلفة.',
    quotaUnavailable: 'حصة Gemini غير متاحة الآن. انتظر بضع دقائق ثم حاول مرة أخرى.',
    shortRateLimit: (seconds: number) =>
      `وصل Gemini إلى حد مؤقت. انتظر حوالي ${seconds} ثانية، ثم أرسل مرة أخرى.`,
    stoppedEarly: (reason: string) => `[توقف Gemini مبكرا: ${reason}]`,
  },
};

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
