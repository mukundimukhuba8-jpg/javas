import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { cloudFriendlyImage, compressEaImageLocal } from '../cloud/oracleCloud';

export type PickEaImageOpts = {
  /** Fires as soon as a local compressed preview is ready (before cloud host). */
  onPreview?: (uri: string) => void;
  /** Prefer Storage path keyed by this EA id when hosting. */
  eaId?: string;
};

/**
 * Pick an image and return a cloud-ready URI (https or compact JPEG data URL).
 * Shows an optimistic compressed preview immediately via onPreview; hosting races
 * with a short timeout so the UI is never blocked on a stuck upload.
 */
export async function pickEaImageAsDataUrl(opts?: PickEaImageOpts): Promise<string | null> {
  let raw: string | null = null;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    raw = await pickFileAsDataUrl('image/*');
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [3, 4],
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    if (asset.base64) {
      const mime = asset.mimeType || 'image/jpeg';
      raw = `data:${mime};base64,${asset.base64}`;
    } else {
      raw = asset.uri;
    }
  }

  if (!raw) return null;

  // Fast local compress → optimistic preview (never wait on network here)
  const preview =
    (await compressEaImageLocal(raw).catch(() => null)) ||
    (raw.startsWith('data:') || /^https?:\/\//i.test(raw) ? raw : null);
  if (preview) opts?.onPreview?.(preview);

  try {
    // Host to durable https so Auth catalog / Home clients keep the picture
    const friendly = await cloudFriendlyImage(preview || raw, {
      eaId: opts?.eaId,
      requireHttps: true,
    });
    return friendly || preview || raw;
  } catch {
    // Still return local preview — pushEaToCloud will retry hosting
    return preview || raw;
  }
}

function pickFileAsDataUrl(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : null;
        resolve(result);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.oncancel = () => {
      document.body.removeChild(input);
      resolve(null);
    };
    document.body.appendChild(input);
    input.click();
  });
}
