import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodeSettings, type SceneId, type Settings } from '../domain/model';
import { createSerialWriter } from '../domain/transactions';
const key = (id: SceneId) => `little-scenes:v1:${id}`;
export const loadSettings = async (id: SceneId) =>
  decodeSettings(id, await AsyncStorage.getItem(key(id)));
const writers = {
  scratch: createSerialWriter((s) => AsyncStorage.setItem(key('scratch'), s)),
  embroidery: createSerialWriter((s) => AsyncStorage.setItem(key('embroidery'), s)),
  rain: createSerialWriter((s) => AsyncStorage.setItem(key('rain'), s)),
};
export const saveSettings = (s: Settings) => writers[s.scene](JSON.stringify(s));
