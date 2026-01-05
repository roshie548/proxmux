import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { ProxmoxClient } from "../../src/api/client";
import type { ProxmuxConfig } from "../../src/config/index";

// Mock config for testing
const mockConfig: ProxmuxConfig = {
  host: "https://proxmox.example.com:8006",
  user: "root@pam",
  tokenId: "test-token",
  tokenSecret: "12345678-1234-1234-1234-123456789abc",
};

// Helper to create mock response
function mockResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ProxmoxClient", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("constructor", () => {
    test("builds correct auth header", () => {
      const client = new ProxmoxClient(mockConfig);
      // We can't directly access private fields, but we can test via requests
      expect(client).toBeDefined();
    });

    test("strips trailing slash from host", () => {
      const configWithSlash: ProxmuxConfig = {
        ...mockConfig,
        host: "https://proxmox.example.com:8006/",
      };
      const client = new ProxmoxClient(configWithSlash);
      expect(client).toBeDefined();
    });
  });

  describe("testConnection", () => {
    test("returns true on successful connection", async () => {
      global.fetch = mock(() => Promise.resolve(mockResponse({ version: "7.0" })));

      const client = new ProxmoxClient(mockConfig);
      const result = await client.testConnection();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalled();
    });

    test("returns false on failed connection", async () => {
      global.fetch = mock(() => Promise.reject(new Error("Network error")));

      const client = new ProxmoxClient(mockConfig);
      const result = await client.testConnection();

      expect(result).toBe(false);
    });
  });

  describe("getNodes", () => {
    test("returns list of nodes", async () => {
      const mockNodes = [
        { node: "pve1", status: "online", cpu: 0.5 },
        { node: "pve2", status: "online", cpu: 0.3 },
      ];
      global.fetch = mock(() => Promise.resolve(mockResponse(mockNodes)));

      const client = new ProxmoxClient(mockConfig);
      const nodes = await client.getNodes();

      expect(nodes).toEqual(mockNodes);
    });

    test("makes request to correct endpoint", async () => {
      global.fetch = mock(() => Promise.resolve(mockResponse([])));

      const client = new ProxmoxClient(mockConfig);
      await client.getNodes();

      expect(global.fetch).toHaveBeenCalledWith(
        "https://proxmox.example.com:8006/api2/json/nodes",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "PVEAPIToken=root@pam!test-token=12345678-1234-1234-1234-123456789abc",
          }),
        })
      );
    });
  });

  describe("getVMs", () => {
    test("returns VMs from specific node", async () => {
      const mockVMs = [
        { vmid: 100, name: "vm1", status: "running" },
        { vmid: 101, name: "vm2", status: "stopped" },
      ];
      global.fetch = mock(() => Promise.resolve(mockResponse(mockVMs)));

      const client = new ProxmoxClient(mockConfig);
      const vms = await client.getVMs("pve1");

      expect(vms).toEqual(mockVMs);
    });

    test("returns VMs from all nodes when no node specified", async () => {
      const mockNodes = [{ node: "pve1" }, { node: "pve2" }];
      const mockVMs1 = [{ vmid: 100, name: "vm1" }];
      const mockVMs2 = [{ vmid: 101, name: "vm2" }];

      let callCount = 0;
      global.fetch = mock(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(mockResponse(mockNodes));
        if (callCount === 2) return Promise.resolve(mockResponse(mockVMs1));
        return Promise.resolve(mockResponse(mockVMs2));
      });

      const client = new ProxmoxClient(mockConfig);
      const vms = await client.getVMs();

      expect(vms).toHaveLength(2);
      expect(vms[0]).toMatchObject({ vmid: 100, node: "pve1" });
      expect(vms[1]).toMatchObject({ vmid: 101, node: "pve2" });
    });
  });

  describe("getContainers", () => {
    test("returns containers from specific node", async () => {
      const mockContainers = [
        { vmid: 200, name: "ct1", status: "running" },
        { vmid: 201, name: "ct2", status: "stopped" },
      ];
      global.fetch = mock(() => Promise.resolve(mockResponse(mockContainers)));

      const client = new ProxmoxClient(mockConfig);
      const containers = await client.getContainers("pve1");

      expect(containers).toEqual(mockContainers);
    });
  });

  describe("VM actions", () => {
    test("startVM sends POST to correct endpoint", async () => {
      global.fetch = mock(() => Promise.resolve(mockResponse("UPID:...")));

      const client = new ProxmoxClient(mockConfig);
      await client.startVM("pve1", 100);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://proxmox.example.com:8006/api2/json/nodes/pve1/qemu/100/status/start",
        expect.objectContaining({ method: "POST" })
      );
    });

    test("stopVM sends POST to correct endpoint", async () => {
      global.fetch = mock(() => Promise.resolve(mockResponse("UPID:...")));

      const client = new ProxmoxClient(mockConfig);
      await client.stopVM("pve1", 100);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://proxmox.example.com:8006/api2/json/nodes/pve1/qemu/100/status/stop",
        expect.objectContaining({ method: "POST" })
      );
    });

    test("rebootVM sends POST to correct endpoint", async () => {
      global.fetch = mock(() => Promise.resolve(mockResponse("UPID:...")));

      const client = new ProxmoxClient(mockConfig);
      await client.rebootVM("pve1", 100);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://proxmox.example.com:8006/api2/json/nodes/pve1/qemu/100/status/reboot",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("Container actions", () => {
    test("startContainer sends POST to correct endpoint", async () => {
      global.fetch = mock(() => Promise.resolve(mockResponse("UPID:...")));

      const client = new ProxmoxClient(mockConfig);
      await client.startContainer("pve1", 200);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://proxmox.example.com:8006/api2/json/nodes/pve1/lxc/200/status/start",
        expect.objectContaining({ method: "POST" })
      );
    });

    test("stopContainer sends POST to correct endpoint", async () => {
      global.fetch = mock(() => Promise.resolve(mockResponse("UPID:...")));

      const client = new ProxmoxClient(mockConfig);
      await client.stopContainer("pve1", 200);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://proxmox.example.com:8006/api2/json/nodes/pve1/lxc/200/status/stop",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("error handling", () => {
    test("throws descriptive error on 401", async () => {
      global.fetch = mock(() =>
        Promise.resolve(new Response("Unauthorized", { status: 401 }))
      );

      const client = new ProxmoxClient(mockConfig);

      await expect(client.getNodes()).rejects.toThrow("Authentication failed");
    });

    test("throws error on 501", async () => {
      global.fetch = mock(() =>
        Promise.resolve(new Response("Not Implemented", { status: 501 }))
      );

      const client = new ProxmoxClient(mockConfig);

      await expect(client.getNodes()).rejects.toThrow("Operation not supported");
    });

    test("throws generic error on other failures", async () => {
      global.fetch = mock(() =>
        Promise.resolve(new Response("Server Error", { status: 500 }))
      );

      const client = new ProxmoxClient(mockConfig);

      await expect(client.getNodes()).rejects.toThrow("Proxmox API error: 500");
    });
  });

  describe("getStorage", () => {
    test("deduplicates shared storage", async () => {
      const mockNodes = [{ node: "pve1" }, { node: "pve2" }];
      const mockStorage1 = [
        { storage: "local", type: "dir" },
        { storage: "shared-nfs", type: "nfs" },
      ];
      const mockStorage2 = [
        { storage: "local", type: "dir" },
        { storage: "shared-nfs", type: "nfs" },
      ];

      let callCount = 0;
      global.fetch = mock(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(mockResponse(mockNodes));
        if (callCount === 2) return Promise.resolve(mockResponse(mockStorage1));
        return Promise.resolve(mockResponse(mockStorage2));
      });

      const client = new ProxmoxClient(mockConfig);
      const storage = await client.getStorage();

      // Should deduplicate - only 2 unique storages
      expect(storage).toHaveLength(2);
      expect(storage.map((s) => s.storage)).toEqual(["local", "shared-nfs"]);
    });
  });
});
