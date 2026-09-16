import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandColors, Colors, Fonts, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAccentPalette } from '@/lib/app-preferences';
import { useI18n } from '@/lib/localization';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const accent = useAccentPalette();
  const { text } = useI18n();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: accent.primary,
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark ? BrandColors.darkSurface : BrandColors.lightSurface,
                borderRadius: 28,
              },
            ]}
          />
        ),
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
        tabBarHideOnKeyboard: true,
        tabBarIconStyle: styles.tabIcon,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: {
          backgroundColor: isDark ? BrandColors.darkSurface : BrandColors.lightSurface,
          borderColor: isDark ? BrandColors.darkBorder : BrandColors.lightBorder,
          borderTopWidth: 0,
          borderWidth: isDark ? StyleSheet.hairlineWidth : 0,
          borderRadius: 34,
          bottom: Layout.tabBarBottomOffset + 6,
          height: Layout.tabBarHeight + insets.bottom,
          left: 18,
          overflow: 'hidden',
          paddingBottom: Math.max(insets.bottom + 14, 18),
          paddingTop: 8,
          position: 'absolute',
          right: 18,
          boxShadow: isDark ? '0 8px 18px rgba(0, 0, 0, 0.28)' : 'none',
          elevation: isDark ? 12 : 0,
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: text.tabs.home,
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
          title: text.tabs.guide,
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="fork.knife" color={color} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: text.tabs.log,
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: text.tabs.chat,
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="message.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: text.tabs.settings,
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="gearshape.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    marginBottom: 0,
    marginTop: 0,
  },
  tabItem: {
    borderRadius: 22,
    height: 48,
    justifyContent: 'center',
    paddingVertical: 0,
  },
  tabLabel: {
    fontFamily: Fonts.displayMedium,
    fontSize: 8,
    lineHeight: 10,
    marginTop: 0,
    paddingBottom: 0,
    textShadowColor: 'transparent',
    textShadowRadius: 0,
  },
});
