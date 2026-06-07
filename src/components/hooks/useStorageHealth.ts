import { useEffect } from 'react';
import { getStorageUsage, isSaveStorageKey } from '@/lib/gameState';

interface UseStorageHealthOptions {
  onWarning: (message: string) => void;
}

export function useStorageHealth({ onWarning }: UseStorageHealthOptions) {
  useEffect(() => {
    const usage = getStorageUsage();
    if (usage.isNearLimit) {
      onWarning('本地存档空间接近上限，已自动精简旧记录');
    }
  }, [onWarning]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (!isSaveStorageKey(event.key)) return;
      onWarning('检测到其他标签页正在修改存档，请避免同时游玩同一旅程');
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [onWarning]);
}
