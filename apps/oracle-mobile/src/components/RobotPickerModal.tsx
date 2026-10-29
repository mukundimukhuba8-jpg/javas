import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from '../theme';
import type { UnlockedRobot } from '../license/types';

type Props = {
  visible: boolean;
  robots: UnlockedRobot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onOpenPortal?: () => void;
};

export function RobotPickerModal({
  visible,
  robots,
  selectedId,
  onSelect,
  onClose,
  onOpenPortal,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.head}>
            <Text style={styles.title}>Your robots</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>
          <Text style={styles.sub}>
            Robots unlocked by activated license keys. Switch which one shows on Home.
          </Text>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {robots.length === 0 ? (
              <Text style={styles.empty}>No robots yet — activate a key first</Text>
            ) : (
              robots.map((robot) => {
                const selected = robot.id === selectedId;
                return (
                  <Pressable
                    key={robot.id}
                    style={[styles.row, selected && styles.rowSelected]}
                    onPress={() => {
                      onSelect(robot.id);
                      onClose();
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    {robot.imageUri ? (
                      <Image source={{ uri: robot.imageUri }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbEmpty]}>
                        <Ionicons name="hardware-chip-outline" size={22} color={colors.textMuted} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>
                        {robot.name}
                      </Text>
                      <Text style={styles.meta}>Activated</Text>
                    </View>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.neon} />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
          {onOpenPortal ? (
            <Pressable
              style={styles.portalBtn}
              onPress={() => {
                onClose();
                onOpenPortal();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.portalBtnText}>Open Portal</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0E101F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(106,160,248,0.35)',
    padding: 18,
    maxHeight: '72%',
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  sub: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 12,
    lineHeight: 18,
  },
  list: { flexGrow: 0 },
  listContent: { gap: 8, paddingBottom: 8 },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.actionRow,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rowSelected: {
    borderColor: colors.neon,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  portalBtn: {
    marginTop: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.neon,
    paddingVertical: 14,
    alignItems: 'center',
  },
  portalBtnText: {
    color: '#061018',
    fontWeight: '800',
    fontSize: 14,
  },
});
