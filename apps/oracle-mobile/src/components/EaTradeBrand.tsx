import { Platform, StyleSheet, Text, View } from 'react-native';

type MarkProps = {
  /** Larger faint watermark for Activate background */
  watermark?: boolean;
  size?: 'sm' | 'md' | 'lg';
};

/** Phone + target + arrow mark used across Sign in / Activate. */
export function EaTradeIcon({ watermark = false, size = 'md' }: MarkProps) {
  const s = size === 'lg' ? 1.8 : size === 'sm' ? 0.85 : 1;
  const color = watermark ? 'rgba(255,255,255,0.07)' : '#FFFFFF';
  return (
    <View
      style={[
        icon.phone,
        {
          width: 28 * s,
          height: 40 * s,
          borderRadius: 5 * s,
          borderWidth: Math.max(1.2, 1.5 * s),
          borderColor: color,
          paddingTop: 4 * s,
        },
      ]}
      accessibilityElementsHidden
    >
      <View
        style={{
          width: 8 * s,
          height: 2 * s,
          borderRadius: 1,
          backgroundColor: color,
          marginBottom: 4 * s,
        }}
      />
      <View
        style={{
          width: 16 * s,
          height: 16 * s,
          borderRadius: 8 * s,
          borderWidth: Math.max(1.2, 1.5 * s),
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 9 * s,
            height: 9 * s,
            borderRadius: 5 * s,
            borderWidth: Math.max(1, 1.25 * s),
            borderColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 3 * s,
              height: 3 * s,
              borderRadius: 2 * s,
              backgroundColor: color,
            }}
          />
        </View>
      </View>
      <View
        style={{
          position: 'absolute',
          width: 14 * s,
          height: Math.max(1.2, 1.5 * s),
          backgroundColor: color,
          top: 10 * s,
          left: 14 * s,
          transform: [{ rotate: '-42deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          top: 2 * s,
          left: 24 * s,
          borderLeftWidth: 4 * s,
          borderRightWidth: 4 * s,
          borderBottomWidth: 6 * s,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
          transform: [{ rotate: '48deg' }],
        }}
      />
    </View>
  );
}

/** Squircle app icon with eatrade word (Sign in). */
export function EaTradeLogoMark() {
  return (
    <View style={logo.mark} accessibilityElementsHidden>
      <EaTradeIcon size="md" />
      <Text style={logo.word}>eatrade</Text>
    </View>
  );
}

/** Compact brand stack for Activate: icon + eatrade word, no squircle. */
export function EaTradeLogoStack() {
  return (
    <View style={stack.wrap} accessibilityElementsHidden>
      <EaTradeIcon size="md" />
      <Text style={stack.word}>eatrade</Text>
    </View>
  );
}

const icon = StyleSheet.create({
  phone: {
    alignItems: 'center',
    overflow: 'visible',
  },
});

const logo = StyleSheet.create({
  mark: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: '#14161C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...Platform.select({
      web: { boxShadow: '0 12px 32px rgba(0,0,0,0.45)' } as object,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
    }),
  },
  word: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

const stack = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
  },
  word: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
