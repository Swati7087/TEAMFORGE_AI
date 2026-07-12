import { useCallback, useEffect, useState } from "react";
import * as githubApi from "../api/github.api";

/**
 * Fetches GitHub data for a project. `connected` is true when a Repository
 * document exists and the fetch succeeded; 404 means no repo linked yet.
 */
export function useGithub(projectId, { enabled = true } = {}) {
  const [connected, setConnected] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!projectId || !enabled) return false;
    setLoading(true);
    setError(null);
    try {
      const result = await githubApi.getRepositoryData(projectId);
      setData(result);
      setConnected(true);
      return true;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        setConnected(false);
        setData(null);
        setError(null);
      } else {
        setError(
          err?.response?.data?.message ||
            err.message ||
            "Failed to load GitHub data"
        );
        setConnected(false);
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [projectId, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    refetch();
  }, [refetch, enabled]);

  return { connected, data, loading, error, refetch };
}
