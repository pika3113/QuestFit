import { useEffect, useMemo, useRef, useState } from 'react';

export type EmulatedHeartRateOptions = {
  enabled: boolean;
  devices?: Array<{ id: string; name?: string | null }>;
  overrides?: Record<string, number | null | undefined>;
  updateIntervalMs?: number;
  seed?: number;
};

type InternalDevice = { id: string; name: string };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hashStringToInt(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hrProfile(tSeconds: number, noise: number) {
  // Simple session: warmup -> work -> cooldown
  // warmup: 0-60s ramps 85 -> 120
  // work: 60-480s waves around 155
  // cooldown: 480-600s ramps 145 -> 95
  if (tSeconds < 60) {
    const p = tSeconds / 60;
    return 85 + p * (120 - 85) + noise;
  }
  if (tSeconds < 480) {
    const x = (tSeconds - 60) / 420;
    const wave = Math.sin(x * Math.PI * 6) * 12;
    return 155 + wave + noise;
  }
  if (tSeconds < 600) {
    const p = (tSeconds - 480) / 120;
    return 145 + (1 - p) * (95 - 145) + noise;
  }
  // After 10 minutes, keep cruising with gentle drift.
  const drift = Math.sin((tSeconds - 600) / 30) * 6;
  return 125 + drift + noise;
}

export function useEmulatedHeartRate(options: EmulatedHeartRateOptions) {
  const { enabled, devices, overrides, updateIntervalMs = 1000, seed = 1 } = options;

  const resolvedDevices: InternalDevice[] = useMemo(() => {
    if (devices && devices.length > 0) {
      return devices.map((d) => ({ id: d.id, name: d.name ?? d.id }));
    }
    return [
      { id: 'EMU-1', name: 'Polar Pacer (Emu 1)' },
      { id: 'EMU-2', name: 'Polar Pacer (Emu 2)' },
      { id: 'EMU-3', name: 'Polar Pacer (Emu 3)' },
    ];
  }, [devices]);

  const [deviceHeartRates, setDeviceHeartRates] = useState<Map<string, number | null>>(new Map());
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      startedAtRef.current = null;
      setDeviceHeartRates(new Map());
      return;
    }

    if (!startedAtRef.current) startedAtRef.current = Date.now();

    const tick = () => {
      const startedAt = startedAtRef.current ?? Date.now();
      const tSeconds = (Date.now() - startedAt) / 1000;

      setDeviceHeartRates(() => {
        const next = new Map<string, number | null>();
        for (const device of resolvedDevices) {
          const override = overrides?.[device.id];
          if (typeof override === 'number' && Number.isFinite(override)) {
            next.set(device.id, Math.round(clamp(override, 40, 240)));
            continue;
          }

          const rng = mulberry32(seed + hashStringToInt(device.id));
          // Make noise stable-ish per tick by mixing time into RNG.
          const n = (rng() - 0.5) * 10;
          const base = hrProfile(tSeconds, n);
          const hr = Math.round(clamp(base, 55, 195));
          next.set(device.id, hr);
        }
        return next;
      });
    };

    tick();
    const interval = setInterval(tick, updateIntervalMs);
    return () => clearInterval(interval);
  }, [enabled, overrides, resolvedDevices, seed, updateIntervalMs]);

  return {
    deviceHeartRates,
    devices: resolvedDevices,
  };
}
