import { useCallback, useEffect, useState } from 'react';
import { bmoni } from '../services/api';

interface BMoniStatus {
  bmoniUserId: string;
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    partnerName?: string;
  } | null;
  kycReadiness: { ready: boolean; missing?: string[] } | null;
  supportedCurrencies: string[];
}

export function useBMoniStatus() {
  const [status, setStatus] = useState<BMoniStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bmoni.status();
      setStatus(data);
    } catch (e: any) {
      setError(e.message || 'Could not load B Moni status');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, error, refresh };
}
