import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCapture: (imageUri: string) => void;
};

/**
 * Web camera capture via getUserMedia (HTTPS Pages / localhost).
 * Mounts a real HTMLVideoElement into a host View.
 */
export function CameraCaptureModal({ visible, onClose, onCapture }: Props) {
  const insets = useSafeAreaInsets();
  const hostNodeRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;

    let cancelled = false;
    setError(null);
    setReady(false);

    const host = hostNodeRef.current;
    if (!host) return;

    const video = document.createElement('video');
    video.setAttribute('playsinline', 'true');
    video.muted = true;
    video.autoplay = true;
    Object.assign(video.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      borderRadius: '18px',
      background: '#05070F',
    });
    host.innerHTML = '';
    host.appendChild(video);
    videoRef.current = video;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Camera API not available in this browser.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();
        setReady(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Camera permission denied';
        setError(`${msg}. On iOS Safari allow camera for this site, or use Upload instead.`);
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      videoRef.current = null;
      if (host) host.innerHTML = '';
    };
  }, [visible]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !ready || typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const uri = canvas.toDataURL('image/jpeg', 0.92);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(uri);
  };

  if (Platform.OS !== 'web') return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>PHOTOGRAPH CHART</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.stage}>
          <View
            // RN-web host node for mounting a real <video>
            ref={(node) => {
              hostNodeRef.current = node as unknown as HTMLElement | null;
            }}
            style={styles.videoHost}
          />
          {!ready && !error ? <Text style={styles.hint}>Starting camera…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            style={[styles.shutter, !ready && styles.shutterDisabled]}
            onPress={capture}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel="Capture chart photo"
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <Text style={styles.footerHint}>Frame the chart, then tap to capture</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.screenH,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.neon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  stage: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.neon,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  videoHost: {
    ...StyleSheet.absoluteFill,
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    color: colors.textMuted,
  },
  error: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    color: '#FF8A8A',
    textAlign: 'center',
    fontSize: 13,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 18,
    gap: 10,
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: colors.neon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: {
    opacity: 0.4,
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.textPrimary,
  },
  footerHint: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
