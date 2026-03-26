import { supabase } from './supabaseClient';

// ✅ 동기화 대상 localStorage 키들
export const SYNC_KEYS: string[] = [
  'stockPortfolio',
  'stockWatchlist',
  'bankAccounts',
  'assetTrend',
  ...Array.from({ length: 12 }, (_, i) => `monthlyBudget_${i + 1}`),
];

type CloudPayload = Record<string, string>;

export type CloudRecord = {
  payload: CloudPayload;
  updatedAt: string | null;
};

type SyncMeta = {
  lastSyncedPayloadHash?: string;
  lastKnownCloudUpdatedAt?: string | null;
  lastPulledAt?: string;
  lastPushedAt?: string;
};

const TABLE = 'user_state';
const SYNC_META_KEY = '__cloudSyncMeta__';

function safeParseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function stableSerialize(payload: CloudPayload): string {
  const sortedKeys = Object.keys(payload).sort();
  const normalized: CloudPayload = {};
  for (const key of sortedKeys) {
    normalized[key] = payload[key];
  }
  return JSON.stringify(normalized);
}

export function hashPayload(payload: CloudPayload): string {
  return stableSerialize(payload);
}

export function readLocalStoragePayload(): CloudPayload {
  const payload: CloudPayload = {};
  for (const key of SYNC_KEYS) {
    const v = localStorage.getItem(key);
    if (v !== null) payload[key] = v;
  }
  return payload;
}

export function readSyncMeta(): SyncMeta {
  return safeParseJson<SyncMeta>(localStorage.getItem(SYNC_META_KEY), {});
}

export function writeSyncMeta(nextMeta: SyncMeta) {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(nextMeta));
}

export function markLocalPayloadSynced(payload: CloudPayload, cloudUpdatedAt?: string | null) {
  const now = new Date().toISOString();
  const prev = readSyncMeta();
  writeSyncMeta({
    ...prev,
    lastSyncedPayloadHash: hashPayload(payload),
    lastKnownCloudUpdatedAt: cloudUpdatedAt ?? prev.lastKnownCloudUpdatedAt ?? null,
    lastPulledAt: prev.lastPulledAt,
    lastPushedAt: now,
  });
}

export function markCloudPayloadApplied(payload: CloudPayload, cloudUpdatedAt?: string | null) {
  const now = new Date().toISOString();
  const prev = readSyncMeta();
  writeSyncMeta({
    ...prev,
    lastSyncedPayloadHash: hashPayload(payload),
    lastKnownCloudUpdatedAt: cloudUpdatedAt ?? prev.lastKnownCloudUpdatedAt ?? null,
    lastPulledAt: now,
  });
}

export function isLocalDirtyComparedToLastSync(payload?: CloudPayload): boolean {
  const currentPayload = payload ?? readLocalStoragePayload();
  const { lastSyncedPayloadHash } = readSyncMeta();
  if (!lastSyncedPayloadHash) return false;
  return hashPayload(currentPayload) !== lastSyncedPayloadHash;
}

export function writeLocalStoragePayload(payload: CloudPayload, options?: { cloudUpdatedAt?: string | null; markAsSynced?: boolean }) {
  // payload에 있는 키만 덮어씀(없는 키는 건드리지 않음)
  for (const key of Object.keys(payload)) {
    localStorage.setItem(key, payload[key]);
  }

  if (options?.markAsSynced !== false) {
    markCloudPayloadApplied(payload, options?.cloudUpdatedAt);
  }
}

export async function pullFromCloud(userId: string): Promise<CloudRecord | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select('payload, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.payload) return null;
  return {
    payload: data.payload as CloudPayload,
    updatedAt: data.updated_at ?? null,
  };
}

export async function pushToCloud(userId: string, payload: CloudPayload): Promise<string | null> {
  if (!supabase) return null;
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        payload,
        updated_at: updatedAt,
      },
      { onConflict: 'user_id' }
    );

  if (error) throw error;
  return updatedAt;
}
