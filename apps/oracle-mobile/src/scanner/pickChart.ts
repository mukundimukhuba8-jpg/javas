import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/** Open library / file picker and return a local URI (blob: or file:). */
export async function pickChartFromLibrary(): Promise<string | null> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return pickViaHtmlFileInput('image/*');
  }

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

/** Native camera via ImagePicker (mobile apps). Web uses CameraCaptureModal + getUserMedia. */
export async function pickChartFromNativeCamera(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

function pickViaHtmlFileInput(accept: string): Promise<string | null> {
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
      resolve(URL.createObjectURL(file));
    };
    input.oncancel = () => {
      document.body.removeChild(input);
      resolve(null);
    };
    document.body.appendChild(input);
    input.click();
  });
}
