import AsyncStorage from '@react-native-async-storage/async-storage';

export type EmulationDevice = {
  deviceId: string;
  userId: string;
  label?: string;
};

const KEY = 'EMULATION_DEVICES_V1';

function canUseLocalStorage(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (!('localStorage' in window)) return false;
    const k = '__qf_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

async function readRaw(): Promise<string | null> {
  // Prefer AsyncStorage on native; fall back to localStorage on web.
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v !== null) return v;
  } catch {
    // ignore
  }

  if (canUseLocalStorage()) {
    return window.localStorage.getItem(KEY);
  }
  return null;
}

async function writeRaw(value: string): Promise<void> {
  // On web, always write localStorage (AsyncStorage may be a no-op).
  if (canUseLocalStorage()) {
    window.localStorage.setItem(KEY, value);
  }

  // Also attempt AsyncStorage (native / some web builds).
  try {
    await AsyncStorage.setItem(KEY, value);
  } catch {
    // ignore
  }
}

export async function getEmulationDevices(): Promise<EmulationDevice[]> {
  const raw = await readRaw();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean);
  } catch {
    return [];
  }
}

export async function setEmulationDevices(devices: EmulationDevice[]): Promise<void> {
  await writeRaw(JSON.stringify(devices));
}

export async function addEmulationDevice(device: EmulationDevice): Promise<void> {
  const existing = await getEmulationDevices();
  const next = [
    device,
    ...existing.filter((d) => !(d.deviceId === device.deviceId && d.userId === device.userId)),
  ];
  await setEmulationDevices(next);
}

export async function removeEmulationDevice(deviceId: string, userId?: string): Promise<void> {
  const existing = await getEmulationDevices();
  await setEmulationDevices(
    existing.filter((d) => {
      if (!userId) return d.deviceId !== deviceId;
      return !(d.deviceId === deviceId && d.userId === userId);
    })
  );
}

export async function clearEmulationDevices(): Promise<void> {
  await setEmulationDevices([]);
}
