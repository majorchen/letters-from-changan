import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { GameSave, loadSaves, normalizeGameSave, saveSaves } from './gameState';

type CloudJourneyRow = {
  id: string;
  user_id: string;
  title: string;
  role: string;
  state: unknown;
  messages: unknown;
  created_at: number;
  updated_at: number;
  schema_version: number;
};

export type CloudSyncResult = {
  ok: boolean;
  message: string;
  uploaded?: number;
  downloaded?: number;
};

export function canUseCloudSaves(): boolean {
  return isSupabaseConfigured();
}

export async function getCloudUserEmail(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.email || null;
}

export async function sendCloudLoginOtp(email: string): Promise<CloudSyncResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, message: '云存档未配置' };
  const cleanedEmail = email.trim();
  if (!cleanedEmail) return { ok: false, message: '请输入邮箱' };
  const { error } = await supabase.auth.signInWithOtp({
    email: cleanedEmail,
    options: {
      shouldCreateUser: true,
    },
  });
  if (error) {
    const message = /send|email|smtp|magic link/i.test(error.message)
      ? '验证码暂时发送失败，请稍后再试'
      : error.message;
    return { ok: false, message };
  }
  return { ok: true, message: `验证码已发送到 ${cleanedEmail}` };
}

export async function verifyCloudLoginOtp(email: string, token: string): Promise<CloudSyncResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, message: '云存档未配置' };
  const cleanedEmail = email.trim();
  const cleanedToken = token.trim();
  if (!cleanedEmail) return { ok: false, message: '请输入邮箱' };
  if (!/^\d{6}$/.test(cleanedToken)) return { ok: false, message: '请输入6位验证码' };
  const { error } = await supabase.auth.verifyOtp({
    email: cleanedEmail,
    token: cleanedToken,
    type: 'email',
  });
  if (error) return { ok: false, message: '验证码错误，请重试' };
  return syncCloudSaves();
}

export async function signOutCloud(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

function saveToRow(save: GameSave, userId: string): CloudJourneyRow {
  return {
    id: save.id,
    user_id: userId,
    title: save.title,
    role: save.role,
    state: save.state,
    messages: save.messages,
    created_at: save.createdAt,
    updated_at: save.updatedAt,
    schema_version: 1,
  };
}

function rowToSave(row: CloudJourneyRow): GameSave {
  return normalizeGameSave({
    id: row.id,
    title: row.title,
    role: row.role,
    state: row.state as GameSave['state'],
    messages: Array.isArray(row.messages) ? row.messages as GameSave['messages'] : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function syncCloudSaves(): Promise<CloudSyncResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, message: '云存档未配置' };
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) return { ok: false, message: userError.message };
  const user = userData.user;
  if (!user) return { ok: false, message: '请先登录云存档' };

  const { data, error } = await supabase
    .from('journeys')
    .select('*')
    .eq('user_id', user.id);
  if (error) return { ok: false, message: error.message };

  const localSaves = loadSaves().map(normalizeGameSave);
  const cloudSaves = (data || []).map((row) => rowToSave(row as CloudJourneyRow));
  const mergedById = new Map<string, GameSave>();
  for (const save of cloudSaves) mergedById.set(save.id, save);
  for (const save of localSaves) {
    const existing = mergedById.get(save.id);
    if (!existing || save.updatedAt >= existing.updatedAt) {
      mergedById.set(save.id, save);
    }
  }
  const merged = [...mergedById.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  const rows = merged.map((save) => saveToRow(save, user.id));
  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from('journeys')
      .upsert(rows, { onConflict: 'id' });
    if (upsertError) return { ok: false, message: upsertError.message };
  }
  saveSaves(merged);
  return {
    ok: true,
    message: `云同步完成：${localSaves.length} 本地 / ${cloudSaves.length} 云端`,
    uploaded: localSaves.length,
    downloaded: cloudSaves.length,
  };
}
