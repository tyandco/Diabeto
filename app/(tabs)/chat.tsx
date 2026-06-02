import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LiquidGlassView } from '@/components/ui/liquid-glass-view';
import { BrandColors, Fonts } from '@/constants/theme';
import { sendDiabetoChat, type ChatImage, type ChatMessage } from '@/lib/diabeto-chatbot';
import { formatHealthContext, useHealthContext } from '@/lib/health-context';

const CHAT_MEMORY_KEY = 'diabeto.chat.messages.v1';

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

type StoredMessage = Pick<ChatMessage, 'id' | 'role' | 'text'>;

export default function ChatScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const healthContext = useHealthContext();
  const healthSummary = formatHealthContext(healthContext);
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [attachedImage, setAttachedImage] = useState<ChatImage | null>(null);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CHAT_MEMORY_KEY)
      .then((value) => {
        if (!value) {
          return;
        }

        const storedMessages = JSON.parse(value) as StoredMessage[];

        if (storedMessages.length > 0) {
          setMessages(storedMessages);
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
        role: message.role,
        text: message.text,
      }));

    AsyncStorage.setItem(CHAT_MEMORY_KEY, JSON.stringify(storedMessages)).catch(() => undefined);
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, isSending, attachedImage]);

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

  const sendMessage = async (overrideText?: string) => {
    const trimmed = (overrideText ?? draft).trim();

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
              {healthSummary ? 'Using Predict data and chat memory' : 'Using chat memory only'}
            </ThemedText>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.messages,
            { paddingBottom: Math.max(16, insets.bottom + 8) },
          ]}>
          {messages.map((message) => (
            <AnimatedMessageBubble key={message.id} isDark={isDark} message={message} />
          ))}
          {isSending ? <TypingBubble isDark={isDark} /> : null}
        </ScrollView>

        <LiquidGlassView isDark={isDark} style={[styles.quickPromptPanel, isDark && styles.quickPromptPanelDark]}>
          <ThemedText style={[styles.quickPromptLabel, isDark && styles.mutedDark]}>
            Meal shortcuts
          </ThemedText>
          <View style={styles.quickPrompts}>
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
          </View>
        </LiquidGlassView>

        <LiquidGlassView
          isDark={isDark}
          interactive
          style={[styles.composer, isDark && styles.composerDark]}>
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
              onPress={attachImage}
              style={[styles.attachButton, isSending && styles.sendButtonDisabled]}>
              <IconSymbol
                color={BrandColors.primary}
                name="paperclip"
                size={17}
                weight="semibold"
              />
              <ThemedText style={styles.attachText}>Attach</ThemedText>
            </Pressable>
            <Pressable
              disabled={isSending}
              onPress={() => sendMessage()}
              style={[styles.sendButton, isSending && styles.sendButtonDisabled]}>
              <IconSymbol
                color="#ffffff"
                name="paperplane.fill"
                size={17}
                weight="semibold"
              />
              <ThemedText style={styles.sendText}>{isSending ? 'Wait' : 'Send'}</ThemedText>
            </Pressable>
          </View>
        </LiquidGlassView>
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
      {!isUser ? <View style={styles.avatar}><ThemedText style={styles.avatarText}>R</ThemedText></View> : null}
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.botBubble,
          !isUser && isDark && styles.botBubbleDark,
        ]}>
        {!isUser ? <ThemedText style={[styles.senderLabel, isDark && styles.mutedDark]}>Ribbon</ThemedText> : null}
        {message.image ? <Image source={{ uri: message.image.uri }} style={styles.messageImage} /> : null}
        <ThemedText style={isUser ? styles.userText : [styles.botText, isDark && styles.botTextDark]}>
          {message.text}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

function TypingBubble({ isDark }: { isDark: boolean }) {
  return (
    <View style={styles.messageRow}>
      <View style={styles.avatar}>
        <ThemedText style={styles.avatarText}>R</ThemedText>
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
    paddingBottom: 14,
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
    backgroundColor: BrandColors.primary,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 16,
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
  quickPrompts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPromptPanel: {
    backgroundColor: BrandColors.lightSurface,
    borderColor: BrandColors.lightBorder,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  quickPromptPanelDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
  },
  quickPromptLabel: {
    color: BrandColors.lightMutedText,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  quickPrompt: {
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.lightBorder,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
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
