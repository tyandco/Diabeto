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

type ChatApiMessage = {
  image?: Omit<ChatImage, 'uri'>;
  role: ChatMessage['role'];
  text: string;
};

export async function sendDiabetoChat(messages: ChatMessage[], healthContext?: string | null) {
  const response = await fetch(getChatApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      healthContext,
      messages: messages.map<ChatApiMessage>((message) => ({
        image: message.image
          ? {
              base64: message.image.base64,
              fileName: message.image.fileName,
              mimeType: message.image.mimeType,
            }
          : undefined,
        role: message.role,
        text: message.text,
      })),
    }),
  });

  const data = (await response.json()) as { reply?: string; error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? 'The chatbot could not reply right now.');
  }

  if (!data.reply) {
    throw new Error('The chatbot returned an empty reply.');
  }

  return data.reply;
}

function getChatApiUrl() {
  return '/api/chat';
}
