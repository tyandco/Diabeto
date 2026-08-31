import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';

import { BrandColors, Fonts } from '@/constants/theme';
import { getAppIconSource } from '@/lib/app-preferences';

type AppIntroSplashProps = {
  isDark: boolean;
};

export function AppIntroSplash({ isDark }: AppIntroSplashProps) {
  const [isVisible, setIsVisible] = useState(true);
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.72)).current;
  const smallTextOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(12)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(iconOpacity, {
          duration: 420,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(iconScale, {
          damping: 15,
          mass: 0.8,
          stiffness: 120,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.stagger(110, [
        Animated.timing(smallTextOpacity, {
          duration: 280,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(titleOpacity, {
            duration: 340,
            easing: Easing.out(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(titleTranslate, {
            duration: 340,
            easing: Easing.out(Easing.cubic),
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.delay(700),
      Animated.timing(splashOpacity, {
        duration: 360,
        easing: Easing.inOut(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished) {
        setIsVisible(false);
      }
    });

    return () => animation.stop();
  }, [iconOpacity, iconScale, smallTextOpacity, splashOpacity, titleOpacity, titleTranslate]);

  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.overlay,
        { backgroundColor: isDark ? BrandColors.darkBackground : BrandColors.lightBackground },
        { opacity: splashOpacity },
      ]}>
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.iconShell,
            {
              opacity: iconOpacity,
              transform: [{ scale: iconScale }],
            },
          ]}>
          <Image source={getAppIconSource()} style={styles.icon} />
        </Animated.View>

        <Animated.Text
          style={[
            styles.welcome,
            { color: isDark ? BrandColors.darkMutedText : BrandColors.lightMutedText },
            { opacity: smallTextOpacity },
          ]}>
          Welcome to
        </Animated.Text>
        <Animated.Text
          style={[
            styles.title,
            { color: isDark ? '#f3fbff' : BrandColors.lightInputText },
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslate }],
            },
          ]}>
          Diabeto
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  icon: {
    borderRadius: 34,
    height: 146,
    width: 146,
  },
  iconShell: {
    alignItems: 'center',
    height: 158,
    justifyContent: 'center',
    marginBottom: 14,
    width: 158,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 1000,
  },
  title: {
    fontFamily: Fonts?.display,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 50,
  },
  welcome: {
    fontFamily: Fonts?.display,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
  },
});
