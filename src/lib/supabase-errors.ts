type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

export function isMissingColumnError(error: unknown, columnName?: string) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as SupabaseErrorLike;
  if (candidate.code !== '42703') {
    return false;
  }

  if (!columnName) {
    return true;
  }

  return typeof candidate.message === 'string' && candidate.message.includes(columnName);
}

export function getSchemaSyncMessage(columnName: string) {
  return `Database schema belum sinkron: kolom ${columnName} belum ada. Jalankan migrasi terbaru di Supabase SQL Editor.`;
}
