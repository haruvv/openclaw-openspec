import { useCallback, useEffect, useRef, useState } from "react";
import { apiCache, apiGet } from "./api";
import type { AgentRun } from "./types";
import { getTargetUrl } from "./utils";

export function useRunningRunsPoll({
  enabled,
  source,
  targetUrl = "",
  limit,
}: {
  enabled: boolean;
  source: string;
  targetUrl?: string;
  limit: number;
}) {
  const [runningRuns, setRunningRuns] = useState<AgentRun[]>([]);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setRunningRuns([]);
      return;
    }

    let active = true;
    const poll = async () => {
      try {
        const result = await apiGet<{ runs: AgentRun[] }>("/api/admin/seo-sales/runs");
        if (!active) return;
        setRunningRuns(
          result.runs
            .filter((run) => run.status === "running" && run.source === source && (!targetUrl || getTargetUrl(run) === targetUrl))
            .slice(0, limit),
        );
        setLastCheckedAt(new Date().toISOString());
      } catch {
        if (active) setLastCheckedAt(new Date().toISOString());
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [enabled, limit, source, targetUrl]);

  return { runningRuns, lastCheckedAt };
}

export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(() => readApiCache<T>(path));
  const [loading, setLoading] = useState(() => !apiCache.has(path));
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchPath = useCallback(async (targetPath: string, force = false, shouldApply: () => boolean = () => true) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const canApply = () => mountedRef.current && requestId === requestIdRef.current && shouldApply();
    const cachedData = readApiCache<T>(targetPath);
    if (cachedData && !force) {
      if (canApply()) {
        setData(cachedData);
        setLoading(false);
      }
    } else {
      if (canApply()) setLoading(true);
    }
    if (canApply()) setError(null);
    try {
      const res = await fetch(targetPath, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = (await res.json()) as T;
      apiCache.set(targetPath, json);
      if (canApply()) setData(json);
    } catch (err) {
      if (canApply()) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      if (canApply()) setLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    await fetchPath(path, true);
  }, [fetchPath, path]);

  useEffect(() => {
    let active = true;
    void fetchPath(path, false, () => active);
    return () => {
      active = false;
    };
  }, [fetchPath, path]);
  return { data, loading, error, reload: load };
}

function readApiCache<T>(path: string): T | null {
  return apiCache.has(path) ? apiCache.get(path) as T : null;
}
