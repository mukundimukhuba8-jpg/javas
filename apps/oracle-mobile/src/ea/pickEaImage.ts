import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { cloudFriendlyImage } from '../cloud/oracleCloud';

/**
 * Pick an image and return a cloud-ready URI (https or compact JPEG data URL).
 * Compresses / hosts before returning so Create EA / Edit picture persist worldwide.
 */
export async function pickEaImageAsDataUrl(): Promise<string | null> {
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
  try {
    const friendly = await cloudFriendlyImage(raw);
    return friendly || raw;
  } catch {
    return raw;
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
