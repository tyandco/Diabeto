import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MarkdownText } from '@/components/markdown-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandColors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAccentPalette, useAppPreferences } from '@/lib/app-preferences';
import { sendDiabetoChat, type ChatImage, type ChatMessage } from '@/lib/diabeto-chatbot';
import { formatDailyLogHistoryForAI, loadDailyLogs } from '@/lib/daily-log';
import { formatHealthContext, useHealthContext } from '@/lib/health-context';

const CHAT_MEMORY_KEY = 'diabeto.chat.messages.v1';
const GOOGLE_AI_STUDIO_KEY_URL = 'https://aistudio.google.com/app/apikey';
const ribbonImage = require('@/assets/images/ribbon.png');

const starterMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'bot',
    text: 'Hi, I am Ribbon. I can help you plan balanced meals, understand food choices, review images, and build habits that lower diabetes risk.',
  },
];

const quickPrompts = [
  'Suggest breakfast',
  'Suggest lunch',
  'Suggest dinner',
  'Healthy snack ideas',
];

type StoredMessage = Pick<ChatMessage, 'id' | 'role' | 'text'> & {
  image?: Pick<ChatImage, 'fileName' | 'previewBase64' | 'previewMimeType' | 'uri'>;
};

export default function ChatScreen() {
  const isDark = useColorScheme() === 'dark';
  const accent = useAccentPalette();
  const preferences = useAppPreferences();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const healthContext = useHealthContext();
  const healthSummary = formatHealthContext(healthContext);
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [attachedImage, setAttachedImage] = useState<ChatImage | null>(null);
  const [draft, setDraft] = useState('');
  const [dailyLogContext, setDailyLogContext] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CHAT_MEMORY_KEY)
      .then((value) => {
        if (!value) {
          return;
        }

        const storedMessages = JSON.parse(value) as StoredMessage[];

        if (storedMessages.length > 0) {
          setMessages(
            storedMessages.map((message) => ({
              ...message,
              image: message.image
                ? {
                    ...message.image,
                    base64: '',
                    mimeType: message.image.previewMimeType ?? 'image/jpeg',
                    uri: getPreviewUri(message.image),
                  }
                : undefined,
            }))
          );
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const storedMessages = messages
      .filter((message) => message.id !== 'welcome')
      .slice(-30)
      .map<StoredMessage>((message) => ({
        id: message.id,
        image: message.image?.previewBase64
          ? {
              fileName: message.image.fileName,
              previewBase64: message.image.previewBase64,
              previewMimeType: message.image.previewMimeType ?? 'image/jpeg',
              uri: message.image.uri,
            }
          : undefined,
        role: message.role,
        text: message.text,
      }));

    AsyncStorage.setItem(CHAT_MEMORY_KEY, JSON.stringify(storedMessages)).catch(() => undefined);
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, isSending, attachedImage]);

  useEffect(() => {
    loadDailyLogs(7)
      .then((entries) => setDailyLogContext(formatDailyLogHistoryForAI(entries)))
      .catch(() => undefined);
  }, [messages.length]);

  const chooseAttachmentSource = () => {
    if (Platform.OS === 'web') {
      pickImage();
      return;
    }

    Alert.alert('Attach image', 'Choose where the image should come from.', [
      { text: 'Take photo', onPress: takePhoto },
      { text: 'Choose photo', onPress: pickImage },
      { style: 'cancel', text: 'Cancel' },
    ]);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      addBotMessage('Photo access is needed before Ribbon can review an image from your library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      base64: false,
      mediaTypes: ['images'],
      quality: 0.5,
    });

    handleImageResult(result);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      addBotMessage('Camera access is needed before Ribbon can review a new photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      base64: false,
      mediaTypes: ['images'],
      quality: 0.5,
    });

    handleImageResult(result);
  };

  const handleImageResult = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];

    if (asset.fileSize && asset.fileSize > 4_000_000) {
      addBotMessage('That image is too large. Please choose a smaller photo.');
      return;
    }

    const [chatImage, preview] = await Promise.all([
      createCompressedImage(asset.uri, 640, 0.48),
      createCompressedImage(asset.uri, 320, 0.5),
    ]);

    if (!chatImage) {
      addBotMessage('I could not process that image. Please choose a different photo.');
      return;
    }

    setAttachedImage({
      base64: chatImage.base64,
      fileName: asset.fileName,
      mimeType: chatImage.mimeType,
      previewBase64: preview?.base64,
      previewMimeType: preview?.mimeType,
      uri: asset.uri,
    });
  };

  const sendMessage = async (overrideText?: string) => {
    const trimmed = (overrideText ?? draft).trim();

    if ((!trimmed && !attachedImage) || isSending) {
      return;
    }

    if (!preferences.geminiApiKey.trim()) {
      addBotMessage('Add your Gemini API key in Settings before chatting with Ribbon.');
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
      const reply = await sendDiabetoChat(
        nextMessages,
        healthSummary,
        preferences.ribbonTone,
        dailyLogContext,
        preferences.geminiApiKey
      );
      addMessage({
        id: `bot-${Date.now()}`,
        role: 'bot',
        text: reply,
      });
    } catch (error) {
      addMessage({
        id: `bot-error-${Date.now()}`,
        role: 'bot',
        text:
          error instanceof Error
            ? error.message
            : 'The chatbot could not reply right now. Please try again.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const clearMemory = () => {
    setMessages(starterMessages);
    AsyncStorage.removeItem(CHAT_MEMORY_KEY).catch(() => undefined);
  };

  const addBotMessage = (text: string) => {
    addMessage({
      id: `bot-${Date.now()}`,
      role: 'bot',
      text,
    });
  };

  const addMessage = (message: ChatMessage) => {
    setMessages((current) => [...current, message]);
  };

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
        style={styles.keyboardView}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <ThemedText type="title">Ribbon</ThemedText>
              <ThemedText style={[styles.subtitle, isDark && styles.mutedDark]}>
                Your Diabeto health companion.
              </ThemedText>
            </View>
            <Pressable onPress={clearMemory} style={[styles.clearButton, isDark && styles.clearButtonDark]}>
              <ThemedText style={[styles.clearText, isDark && styles.contextTextDark]}>
                Clear
              </ThemedText>
            </Pressable>
          </View>
          <View style={[styles.contextPill, isDark && styles.contextPillDark]}>
            <ThemedText style={[styles.contextText, isDark && styles.contextTextDark]}>
              {!preferences.geminiApiKey.trim()
                ? 'Gemini API key needed'
                : healthSummary || dailyLogContext
                  ? 'Using Predict data, daily logs, and chat memory'
                  : 'Using chat memory only'}
            </ThemedText>
          </View>
        </View>

        {!preferences.geminiApiKey.trim() ? (
          <View style={[styles.keyPanel, isDark && styles.keyPanelDark]}>
            <ThemedText type="defaultSemiBold">Ribbon needs your Gemini API key.</ThemedText>
            <ThemedText style={[styles.keyPanelText, isDark && styles.mutedDark]}>
              Create a key in Google AI Studio, copy it, then paste it in Settings.
            </ThemedText>
            <View style={styles.keyPanelActions}>
              <Pressable
                onPress={() => Linking.openURL(GOOGLE_AI_STUDIO_KEY_URL)}
                style={[styles.keyPanelButton, { borderColor: accent.primary }]}>
                <ThemedText style={[styles.keyPanelButtonText, { color: accent.primary }]}>
                  Get an API key
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/settings')}
                style={[styles.keyPanelButton, { backgroundColor: accent.primary, borderColor: accent.primary }]}>
                <ThemedText style={styles.keyPanelPrimaryText}>Open Settings</ThemedText>
              </Pressable>
            </View>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.messagesScroll}
          contentContainerStyle={[
            styles.messages,
            { paddingBottom: 12 },
          ]}>
          {messages.map((message) => (
            <AnimatedMessageBubble key={message.id} isDark={isDark} message={message} />
          ))}
          {isSending ? <TypingBubble isDark={isDark} /> : null}
        </ScrollView>

        <View style={[styles.chatBottom, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <ScrollView
            contentContainerStyle={styles.quickPrompts}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickPromptScroller}>
            {quickPrompts.map((prompt) => (
              <Pressable
                disabled={isSending}
                key={prompt}
                onPress={() => sendMessage(prompt)}
                style={[styles.quickPrompt, isDark && styles.quickPromptDark]}>
                <ThemedText style={[styles.quickPromptText, isDark && styles.contextTextDark]}>
                  {prompt}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          <View style={[styles.composer, isDark && styles.composerDark]}>
            {attachedImage ? (
              <View style={styles.attachmentPreview}>
                <Image source={{ uri: attachedImage.uri }} style={styles.previewImage} />
                <View style={styles.attachmentText}>
                  <ThemedText style={[styles.attachmentTitle, isDark && styles.contextTextDark]}>
                    Image attached
                  </ThemedText>
                  <ThemedText style={[styles.attachmentSubtitle, isDark && styles.mutedDark]}>
                    Ready for Ribbon to review.
                  </ThemedText>
                </View>
                <Pressable onPress={() => setAttachedImage(null)} style={styles.removeImageButton}>
                  <ThemedText style={styles.removeImageText}>Remove</ThemedText>
                </Pressable>
              </View>
            ) : null}
            <TextInput
              multiline
              onChangeText={setDraft}
              placeholder="Ask about meals, habits, or an image..."
              placeholderTextColor={isDark ? '#8faec5' : '#7d8b95'}
              style={[styles.input, attachedImage && styles.inputWithAttachment, isDark && styles.inputDark]}
              value={draft}
            />
            <View style={styles.composerActions}>
              <Pressable
                disabled={isSending}
                onPress={chooseAttachmentSource}
                style={[styles.attachButton, isSending && styles.sendButtonDisabled]}>
                <IconSymbol
                  color={accent.primary}
                  name="paperclip"
                  size={17}
                  weight="semibold"
                />
                <ThemedText style={styles.attachText}>Attach</ThemedText>
              </Pressable>
              <Pressable
                disabled={isSending || !preferences.geminiApiKey.trim()}
                onPress={() => sendMessage()}
                style={[
                  styles.sendButton,
                  { backgroundColor: accent.primary },
                  (isSending || !preferences.geminiApiKey.trim()) && styles.sendButtonDisabled,
                ]}>
                <IconSymbol
                  color="#ffffff"
                  name="paperplane.fill"
                  size={17}
                  weight="semibold"
                />
                <ThemedText style={styles.sendText}>{isSending ? 'Wait' : 'Send'}</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function AnimatedMessageBubble({ message, isDark }: { message: ChatMessage; isDark: boolean }) {
  const isUser = message.role === 'user';
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        duration: 220,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: 220,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.messageRow,
        isUser && styles.userMessageRow,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}>
      {!isUser ? (
        <View style={styles.avatar}>
          <Image source={ribbonImage} style={styles.avatarImage} />
        </View>
      ) : null}
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.botBubble,
          !isUser && isDark && styles.botBubbleDark,
        ]}>
        {!isUser ? <ThemedText style={[styles.senderLabel, isDark && styles.mutedDark]}>Ribbon</ThemedText> : null}
        {message.image ? <Image source={{ uri: getPreviewUri(message.image) }} style={styles.messageImage} /> : null}
        <MarkdownText
          isDark={isDark}
          style={isUser ? styles.userText : [styles.botText, isDark && styles.botTextDark]}
          text={message.text}
        />
      </View>
    </Animated.View>
  );
}

async function createCompressedImage(uri: string, width: number, compress: number) {
  try {
    const context = ImageManipulator.ImageManipulator.manipulate(uri);
    context.resize({ width });
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({
      base64: true,
      compress,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    if (!result.base64) {
      return null;
    }

    return {
      base64: result.base64,
      mimeType: 'image/jpeg',
    };
  } catch {
    return null;
  }
}

function getPreviewUri(image: Pick<ChatImage, 'previewBase64' | 'previewMimeType' | 'uri'>) {
  if (image.previewBase64) {
    return `data:${image.previewMimeType ?? 'image/jpeg'};base64,${image.previewBase64}`;
  }

  return image.uri;
}

function TypingBubble({ isDark }: { isDark: boolean }) {
  return (
    <View style={styles.messageRow}>
      <View style={styles.avatar}>
        <Image source={ribbonImage} style={styles.avatarImage} />
      </View>
      <View style={[styles.bubble, styles.botBubble, isDark && styles.botBubbleDark]}>
        <ThemedText style={[styles.botText, isDark && styles.botTextDark]}>
          Ribbon is preparing a response...
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    gap: 12,
    padding: 20,
    paddingBottom: 0,
    paddingTop: 64,
  },
  header: {
    gap: 10,
  },
  headerTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  subtitle: {
    color: BrandColors.lightMutedText,
  },
  clearButton: {
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearButtonDark: {
    borderColor: BrandColors.darkBorder,
  },
  clearText: {
    color: BrandColors.primaryDark,
    fontWeight: '800',
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
    gap: 14,
    paddingBottom: 8,
  },
  messagesScroll: {
    flex: 1,
  },
  messageRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.primary,
    borderWidth: 1,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 28,
  },
  avatarImage: {
    height: 34,
    marginTop: 3,
    width: 34,
  },
  bubble: {
    borderRadius: 8,
    maxWidth: '84%',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  senderLabel: {
    color: BrandColors.lightMutedText,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  messageImage: {
    borderRadius: 6,
    height: 150,
    marginBottom: 8,
    width: 180,
  },
  botBubble: {
    backgroundColor: BrandColors.lightSurface,
    borderColor: BrandColors.lightBorder,
    borderWidth: 1,
  },
  botBubbleDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  userBubble: {
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
  chatBottom: {
    flexGrow: 0,
    flexShrink: 0,
    gap: 10,
  },
  quickPromptScroller: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 38,
  },
  quickPrompts: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingRight: 6,
  },
  quickPrompt: {
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.lightBorder,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  quickPromptDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  quickPromptText: {
    color: BrandColors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
  },
  composer: {
    alignItems: 'stretch',
    backgroundColor: BrandColors.lightSurface,
    borderColor: BrandColors.lightBorder,
    borderRadius: 18,
    borderWidth: 1,
    flexGrow: 0,
    flexShrink: 0,
    gap: 8,
    maxHeight: 230,
    padding: 10,
  },
  composerDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  input: {
    backgroundColor: BrandColors.lightBackground,
    borderColor: BrandColors.lightBorder,
    borderRadius: 14,
    borderWidth: 1,
    color: BrandColors.lightInputText,
    fontFamily: Fonts?.display,
    fontSize: 16,
    height: 48,
    maxHeight: 96,
    minHeight: 42,
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  inputWithAttachment: {
    height: 44,
  },
  inputDark: {
    backgroundColor: BrandColors.darkBackground,
    borderColor: BrandColors.darkBorder,
    color: BrandColors.darkInputText,
  },
  keyPanel: {
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  keyPanelActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  keyPanelButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 130,
    paddingHorizontal: 14,
  },
  keyPanelButtonText: {
    fontWeight: '900',
  },
  keyPanelDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  keyPanelPrimaryText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  keyPanelText: {
    color: BrandColors.lightMutedText,
  },
  attachmentPreview: {
    alignItems: 'center',
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.lightBorder,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 64,
    padding: 8,
  },
  previewImage: {
    borderRadius: 10,
    height: 48,
    width: 48,
  },
  attachmentText: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  attachmentTitle: {
    color: BrandColors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
  },
  attachmentSubtitle: {
    color: BrandColors.lightMutedText,
    fontSize: 12,
    lineHeight: 16,
  },
  removeImageButton: {
    borderColor: BrandColors.lightBorder,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  removeImageText: {
    color: BrandColors.primaryDark,
    fontWeight: '700',
  },
  composerActions: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  attachButton: {
    alignItems: 'center',
    borderColor: BrandColors.primary,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
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
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
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
