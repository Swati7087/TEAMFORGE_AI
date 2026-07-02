import { useCallback, useEffect, useState } from "react";
import * as projectApi from "../api/project.api";

/**
 * Fetch + expose the current user's projects list (owned OR member-of).
 * Also returns a `refetch` for anywhere that mutates and needs a fresh copy.
 */
export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await projectApi.getProjects();
      setProjects(data || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { projects, loading, error, refetch: load };
}

/**
 * Fetch a single project by ID. Kept separate from `useProjects` because the
 * ProjectDetails page needs the full populated document (owner, members,
 * tasks) whereas the list view only needs summary fields.
 */
export function useProject(projectId) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await projectApi.getProjectById(projectId);
      setProject(data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return { project, loading, error, refetch: load, setProject };
}
