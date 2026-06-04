import { Fragment } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BrandColors, Fonts } from '@/constants/theme';

type MarkdownTextProps = {
  isDark: boolean;
  style?: StyleProp<TextStyle>;
  text: string;
};

export function MarkdownText({ isDark, style, text }: MarkdownTextProps) {
  const lines = text.split(/\r?\n/);

  return (
    <View style={styles.container}>
      {lines.map((line, index) => {
        const bullet = line.match(/^\s*[-*]\s+(.+)/);

        if (bullet) {
          return (
            <View key={`${line}-${index}`} style={styles.bulletRow}>
              <ThemedText style={[styles.bullet, isDark && styles.bulletDark]}>•</ThemedText>
              <ThemedText style={[styles.line, style]}>{renderInlineMarkdown(bullet[1], index)}</ThemedText>
            </View>
          );
        }

        return (
          <ThemedText key={`${line}-${index}`} style={[styles.line, style]}>
            {renderInlineMarkdown(line, index)}
          </ThemedText>
        );
      })}
    </View>
  );
}

function renderInlineMarkdown(line: string, lineIndex: number) {
  const nodes = line.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*)/g).filter(Boolean);

  return nodes.map((node, index) => {
    const key = `${lineIndex}-${index}-${node}`;

    if ((node.startsWith('**') && node.endsWith('**')) || (node.startsWith('__') && node.endsWith('__'))) {
      return (
        <ThemedText key={key} style={styles.bold}>
          {node.slice(2, -2)}
        </ThemedText>
      );
    }

    if (node.startsWith('*') && node.endsWith('*')) {
      return (
        <ThemedText key={key} style={styles.italic}>
          {node.slice(1, -1)}
        </ThemedText>
      );
    }

    if (node.startsWith('`') && node.endsWith('`')) {
      return (
        <ThemedText key={key} style={styles.code}>
          {node.slice(1, -1)}
        </ThemedText>
      );
    }

    return <Fragment key={key}>{node}</Fragment>;
  });
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  line: {
    lineHeight: 24,
  },
  bold: {
    fontFamily: Fonts?.display,
    fontWeight: '900',
  },
  italic: {
    fontFamily: Fonts?.display,
    fontStyle: 'italic',
  },
  code: {
    backgroundColor: 'rgba(120, 144, 161, 0.18)',
    borderRadius: 4,
    fontFamily: Fonts?.mono,
    fontSize: 14,
    paddingHorizontal: 4,
  },
  bullet: {
    color: BrandColors.primary,
    fontSize: 18,
    lineHeight: 24,
  },
  bulletDark: {
    color: BrandColors.darkInputText,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
