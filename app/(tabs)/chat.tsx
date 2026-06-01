import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors } from '@/constants/theme';
import { sendDiabetoChat, type ChatImage, type ChatMessage } from '@/lib/diabeto-chatbot';
import { formatHealthContext, useHealthContext } from '@/lib/health-context';

const starterMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'bot',
    text: 'Hi, I am DiabetoBot. Ask me about healthy meals, exercise, sugary drinks, carbs, or diabetes risk.',
  },
];

export default function ChatScreen() {
  const isDark = useColorScheme() === 'dark';
  const healthContext = useHealthContext();
  const healthSummary = formatHealthContext(healthContext);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [attachedImage, setAttachedImage] = useState<ChatImage | null>(null);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  const attachImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      base64: true,
      mediaTypes: ['images'],
      quality: 0.6,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];

    if (!asset.base64) {
      addBotMessage('I could not read that image. Please choose a different photo.');
      return;
    }

    if (asset.fileSize && asset.fileSize > 4_000_000) {
      addBotMessage('That image is too large. Please choose a smaller photo.');
      return;
    }

    setAttachedImage({
      base64: asset.base64,
      fileName: asset.fileName,
      mimeType: asset.mimeType ?? 'image/jpeg',
      uri: asset.uri,
    });
  };

  const sendMessage = async () => {
    const trimmed = draft.trim();

    if ((!trimmed && !attachedImage) || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      image: attachedImage ?? undefined,
      role: 'user',
      text: trimmed || 'Please review this image and give diabetes prevention advice.',
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setAttachedImage(null);
    setDraft('');
    setIsSending(true);

    try {
      const reply = await sendDiabetoChat(nextMessages, healthSummary);
      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'bot',
        text: reply,
      };

      setMessages((current) => [...current, botMessage]);
    } catch (error) {
      const botMessage: ChatMessage = {
        id: `bot-error-${Date.now()}`,
        role: 'bot',
        text:
          error instanceof Error
            ? error.message
            : 'The chatbot could not reply right now. Please try again.',
      };

      setMessages((current) => [...current, botMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const addBotMessage = (text: string) => {
    setMessages((current) => [
      ...current,
      {
        id: `bot-${Date.now()}`,
        role: 'bot',
        text,
      },
    ]);
  };

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
        style={styles.keyboardView}>
        <View style={styles.header}>
          <ThemedText type="title">Chat</ThemedText>
          <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
            Ask DiabetoBot for prevention advice.
          </ThemedText>
          <View style={[styles.contextPill, isDark && styles.contextPillDark]}>
            <ThemedText style={[styles.contextText, isDark && styles.contextTextDark]}>
              {healthSummary ? 'Using your latest Predict tab data' : 'Add details in Predict first'}
            </ThemedText>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.messages}>
          {messages.map((message) => {
            const isUser = message.role === 'user';
            return (
              <View
                key={message.id}
                style={[
                  styles.bubble,
                  isUser ? styles.userBubble : styles.botBubble,
                  !isUser && isDark && styles.botBubbleDark,
                ]}>
                {message.image ? <Image source={{ uri: message.image.uri }} style={styles.messageImage} /> : null}
                <ThemedText style={isUser ? styles.userText : [styles.botText, isDark && styles.botTextDark]}>
                  {message.text}
                </ThemedText>
              </View>
            );
          })}
          {isSending ? (
            <View style={[styles.bubble, styles.botBubble, isDark && styles.botBubbleDark]}>
              <ThemedText style={[styles.botText, isDark && styles.botTextDark]}>
                DiabetoBot is thinking...
              </ThemedText>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.composer, isDark && styles.composerDark]}>
          {attachedImage ? (
            <View style={styles.attachmentPreview}>
              <Image source={{ uri: attachedImage.uri }} style={styles.previewImage} />
              <Pressable onPress={() => setAttachedImage(null)} style={styles.removeImageButton}>
                <ThemedText style={styles.removeImageText}>Remove</ThemedText>
              </Pressable>
            </View>
          ) : null}
          <TextInput
            multiline
            onChangeText={setDraft}
            placeholder="Ask about meals, exercise, or sugar..."
            placeholderTextColor={isDark ? '#8faec5' : '#7d8b95'}
            style={[styles.input, isDark && styles.inputDark]}
            value={draft}
          />
          <Pressable
            disabled={isSending}
            onPress={attachImage}
            style={[styles.attachButton, isSending && styles.sendButtonDisabled]}>
            <ThemedText style={styles.attachText}>Attach</ThemedText>
          </Pressable>
          <Pressable
            disabled={isSending}
            onPress={sendMessage}
            style={[styles.sendButton, isSending && styles.sendButtonDisabled]}>
            <ThemedText style={styles.sendText}>{isSending ? 'Wait' : 'Send'}</ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    gap: 14,
    padding: 20,
    paddingTop: 64,
  },
  header: {
    gap: 8,
  },
  subtitle: {
    color: BrandColors.lightMutedText,
  },
  contextPill: {
    alignSelf: 'flex-start',
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.lightBorder,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  contextPillDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  contextText: {
    color: BrandColors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  contextTextDark: {
    color: BrandColors.darkInputText,
  },
  mutedDark: {
    color: BrandColors.darkMutedText,
  },
  messages: {
    gap: 12,
    paddingBottom: 8,
  },
  bubble: {
    borderRadius: 8,
    maxWidth: '86%',
    padding: 12,
  },
  messageImage: {
    borderRadius: 6,
    height: 150,
    marginBottom: 8,
    width: 180,
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.lightBorder,
    borderWidth: 1,
  },
  botBubbleDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: BrandColors.primary,
  },
  botText: {
    color: BrandColors.lightInputText,
  },
  botTextDark: {
    color: BrandColors.darkInputText,
  },
  userText: {
    color: '#ffffff',
  },
  composer: {
    alignItems: 'flex-end',
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 8,
  },
  composerDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  input: {
    color: BrandColors.lightInputText,
    flex: 1,
    fontSize: 16,
    maxHeight: 96,
    minHeight: 42,
    minWidth: 160,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  inputDark: {
    color: BrandColors.darkInputText,
  },
  attachmentPreview: {
    alignItems: 'center',
    flexBasis: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  previewImage: {
    borderRadius: 6,
    height: 54,
    width: 54,
  },
  removeImageButton: {
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  removeImageText: {
    color: BrandColors.primaryDark,
    fontWeight: '700',
  },
  attachButton: {
    alignItems: 'center',
    borderColor: BrandColors.primary,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  attachText: {
    color: BrandColors.primary,
    fontWeight: '800',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.primary,
    borderRadius: 8,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sendButtonDisabled: {
    opacity: 0.65,
  },
  sendText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
