import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandColors, Colors, Layout } from '@/constants/theme';
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
              { backgroundColor: isDark ? BrandColors.darkSurface : BrandColors.lightSurface },
            ]}
          />
        ),
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: {
          backgroundColor: isDark ? BrandColors.darkSurface : BrandColors.lightSurface,
          borderColor: isDark ? BrandColors.darkBorder : BrandColors.lightBorder,
          borderTopWidth: 0,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 22,
          bottom: Layout.tabBarBottomOffset,
          height: Layout.tabBarHeight + insets.bottom,
          left: 14,
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 6,
          position: 'absolute',
          right: 14,
          boxShadow: isDark ? '0 8px 18px rgba(0, 0, 0, 0.28)' : '0 8px 18px rgba(24, 35, 31, 0.10)',
          elevation: 12,
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: text.tabs.home,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="predict"
        options={{
          title: text.tabs.predict,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
          title: text.tabs.guide,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="fork.knife" color={color} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: text.tabs.log,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: text.tabs.chat,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="message.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: text.tabs.settings,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    borderRadius: 16,
    paddingVertical: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
});
