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

const TABLE = 'user_state';

export function readLocalStoragePayload(): CloudPayload {
  const payload: CloudPayload = {};
  for (const key of SYNC_KEYS) {
    const v = localStorage.getItem(key);
    if (v !== null) payload[key] = v;
  }
  return payload;
}

export function writeLocalStoragePayload(payload: CloudPayload) {
  // payload에 있는 키만 덮어씀(없는 키는 건드리지 않음)
  for (const key of Object.keys(payload)) {
    localStorage.setItem(key, payload[key]);
  }
}

export async function pullFromCloud(userId: string): Promise<CloudPayload | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.payload) return null;
  return data.payload as CloudPayload;
}

export async function pushToCloud(userId: string, payload: CloudPayload) {
  if (!supabase) return;
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) throw error;
}
