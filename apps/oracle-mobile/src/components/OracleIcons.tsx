import { View, StyleSheet } from 'react-native';

type IconProps = {
  color: string;
  size?: number;
};

/** Geometric icons — paint immediately (no vector-font wait). */

export function IconPlay({ color, size = 22 }: IconProps) {
  const h = size * 0.72;
  const w = size * 0.58;
  return (
    <View
      style={{
        width: 0,
        height: 0,
        marginLeft: size * 0.08,
        borderTopWidth: h / 2,
        borderBottomWidth: h / 2,
        borderLeftWidth: w,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: color,
      }}
    />
  );
}

export function IconPause({ color, size = 22 }: IconProps) {
  const barW = Math.max(3, Math.round(size * 0.18));
  const barH = Math.round(size * 0.7);
  const gap = Math.round(size * 0.14);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap }}>
      <View style={{ width: barW, height: barH, borderRadius: 1, backgroundColor: color }} />
      <View style={{ width: barW, height: barH, borderRadius: 1, backgroundColor: color }} />
    </View>
  );
}

export function IconPulse({ color, size = 24 }: IconProps) {
  const stroke = Math.max(2, Math.round(size * 0.1));
  const mid = size * 0.5;
  return (
    <View style={{ width: size, height: size * 0.55, justifyContent: 'center' }}>
      <View
        style={{
          height: stroke,
          backgroundColor: color,
          borderRadius: stroke,
          width: '100%',
          position: 'absolute',
          top: mid * 0.45,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.28,
          top: size * 0.05,
          width: stroke,
          height: size * 0.45,
          backgroundColor: color,
          borderRadius: stroke,
          transform: [{ rotate: '25deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.42,
          top: size * 0.02,
          width: stroke,
          height: size * 0.5,
          backgroundColor: color,
          borderRadius: stroke,
          transform: [{ rotate: '-35deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.58,
          top: size * 0.08,
          width: stroke,
          height: size * 0.4,
          backgroundColor: color,
          borderRadius: stroke,
          transform: [{ rotate: '30deg' }],
        }}
      />
    </View>
  );
}

export function IconTrash({ color, size = 22 }: IconProps) {
  const w = size * 0.62;
  const lid = size * 0.12;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: w * 0.55,
          height: lid,
          backgroundColor: color,
          borderRadius: 1,
          marginBottom: 2,
        }}
      />
      <View
        style={{
          width: w * 0.28,
          height: lid * 0.7,
          backgroundColor: color,
          borderRadius: 1,
          marginBottom: 2,
        }}
      />
      <View
        style={{
          width: w,
          height: size * 0.48,
          borderWidth: 2,
          borderColor: color,
          borderRadius: 3,
          borderTopWidth: 2,
        }}
      />
    </View>
  );
}

export function IconPlus({ color, size = 26 }: IconProps) {
  const t = Math.max(2, Math.round(size * 0.12));
  const arm = size * 0.62;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: arm,
          height: t,
          borderRadius: t,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: t,
          height: arm,
          borderRadius: t,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function IconChevronRight({ color, size = 22 }: IconProps) {
  const s = size * 0.38;
  return (
    <View
      style={{
        width: s,
        height: s,
        borderTopWidth: 2.5,
        borderRightWidth: 2.5,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
        marginRight: 4,
      }}
    />
  );
}

export function IconHome({ color, size = 22 }: IconProps) {
  const roof = size * 0.55;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: roof * 0.75,
          borderRightWidth: roof * 0.75,
          borderBottomWidth: roof * 0.65,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
          marginBottom: -1,
        }}
      />
      <View
        style={{
          width: size * 0.55,
          height: size * 0.4,
          borderWidth: 2,
          borderColor: color,
          borderTopWidth: 0,
          borderBottomLeftRadius: 2,
          borderBottomRightRadius: 2,
        }}
      />
    </View>
  );
}

export function IconScan({ color, size = 22 }: IconProps) {
  const arm = size * 0.28;
  const t = 2.5;
  const box = size * 0.78;
  return (
    <View style={{ width: box, height: box }}>
      <View style={[styles.corner, { top: 0, left: 0, width: arm, height: t, backgroundColor: color }]} />
      <View style={[styles.corner, { top: 0, left: 0, width: t, height: arm, backgroundColor: color }]} />
      <View style={[styles.corner, { top: 0, right: 0, width: arm, height: t, backgroundColor: color }]} />
      <View style={[styles.corner, { top: 0, right: 0, width: t, height: arm, backgroundColor: color }]} />
      <View style={[styles.corner, { bottom: 0, left: 0, width: arm, height: t, backgroundColor: color }]} />
      <View style={[styles.corner, { bottom: 0, left: 0, width: t, height: arm, backgroundColor: color }]} />
      <View style={[styles.corner, { bottom: 0, right: 0, width: arm, height: t, backgroundColor: color }]} />
      <View style={[styles.corner, { bottom: 0, right: 0, width: t, height: arm, backgroundColor: color }]} />
    </View>
  );
}

export function IconWallet({ color, size = 22 }: IconProps) {
  return (
    <View
      style={{
        width: size * 0.85,
        height: size * 0.62,
        borderWidth: 2,
        borderColor: color,
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingRight: 3,
      }}
    >
      <View
        style={{
          width: size * 0.22,
          height: size * 0.22,
          borderRadius: size * 0.11,
          borderWidth: 2,
          borderColor: color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  corner: {
    position: 'absolute',
    borderRadius: 1,
  },
});
