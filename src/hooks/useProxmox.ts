import { useState, useEffect, useCallback } from "react";
import { getClient } from "../api/client.ts";
import type { Node, VM, Container, Storage } from "../api/types.ts";

export function useNodes() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getClient().getNodes();
      setNodes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch nodes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { nodes, loading, error, refresh };
}

export function useVMs() {
  const [vms, setVMs] = useState<VM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getClient().getVMs();
      setVMs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch VMs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startVM = useCallback(async (node: string, vmid: number) => {
    await getClient().startVM(node, vmid);
    await refresh();
  }, [refresh]);

  const stopVM = useCallback(async (node: string, vmid: number) => {
    await getClient().stopVM(node, vmid);
    await refresh();
  }, [refresh]);

  const rebootVM = useCallback(async (node: string, vmid: number) => {
    await getClient().rebootVM(node, vmid);
    await refresh();
  }, [refresh]);

  return { vms, loading, error, refresh, startVM, stopVM, rebootVM };
}

export function useContainers() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getClient().getContainers();
      setContainers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch containers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startContainer = useCallback(async (node: string, vmid: number) => {
    await getClient().startContainer(node, vmid);
    await refresh();
  }, [refresh]);

  const stopContainer = useCallback(async (node: string, vmid: number) => {
    await getClient().stopContainer(node, vmid);
    await refresh();
  }, [refresh]);

  const rebootContainer = useCallback(async (node: string, vmid: number) => {
    await getClient().rebootContainer(node, vmid);
    await refresh();
  }, [refresh]);

  return { containers, loading, error, refresh, startContainer, stopContainer, rebootContainer };
}

export function useStorage() {
  const [storage, setStorage] = useState<Storage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getClient().getStorage();
      setStorage(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch storage");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { storage, loading, error, refresh };
}
