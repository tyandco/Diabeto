import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';

import { BrandColors, Fonts } from '@/constants/theme';

type AppIntroSplashProps = {
  isDark: boolean;
};

export function AppIntroSplash({ isDark }: AppIntroSplashProps) {
  const [isVisible, setIsVisible] = useState(true);
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.84)).current;
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
          damping: 14,
          mass: 0.8,
          stiffness: 130,
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
      pointerEvents="none"
      style={[
        styles.overlay,
        { backgroundColor: isDark ? BrandColors.darkBackground : BrandColors.lightBackground },
        { opacity: splashOpacity },
      ]}>
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.iconShell,
            isDark && styles.iconShellDark,
            {
              opacity: iconOpacity,
              transform: [{ scale: iconScale }],
            },
          ]}>
          <Image source={require('@/assets/images/icon.png')} style={styles.icon} />
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
    borderRadius: 24,
    height: 86,
    width: 86,
  },
  iconShell: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: BrandColors.lightBorder,
    borderRadius: 32,
    borderWidth: 1,
    elevation: 7,
    height: 108,
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: BrandColors.primary,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    width: 108,
  },
  iconShellDark: {
    backgroundColor: BrandColors.darkSurface,
    borderColor: BrandColors.darkBorder,
    shadowOpacity: 0.28,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
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
