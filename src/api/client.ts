import type { ProxmuxConfig } from "../config/index.ts";
import type {
  ProxmoxResponse,
  Node,
  VM,
  VMConfig,
  Container,
  ContainerConfig,
  ContainerConfigUpdate,
  Storage,
  Task,
  ResourceSummary,
  NetworkInterface,
} from "./types.ts";

export class ProxmoxClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: ProxmuxConfig) {
    this.baseUrl = config.host.replace(/\/$/, "");
    this.authHeader = `PVEAPIToken=${config.user}!${config.tokenId}=${config.tokenSecret}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}/api2/json${path}`;

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
    };

    const options: RequestInit = {
      method,
      headers,
      // Skip SSL verification for self-signed certs (common in Proxmox)
      // @ts-expect-error - Bun supports this option
      tls: {
        rejectUnauthorized: false,
      },
    };

    if (body) {
      // Proxmox expects form-urlencoded for POST/PUT
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        params.append(key, String(value));
      }
      options.body = params.toString();
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401) {
        throw new Error(
          `Authentication failed (401). Check your API token:\n` +
          `  - User format: user@realm (e.g., root@pam)\n` +
          `  - Token name: just the name portion (e.g., proxmux), not the full ID\n` +
          `  - Ensure "Privilege Separation" is unchecked in Proxmox\n` +
          `  - Run 'proxmux --config' to reconfigure`
        );
      }
      if (response.status === 501) {
        throw new Error(`Operation not supported (501)`);
      }
      throw new Error(`Proxmox API error: ${response.status} - ${text}`);
    }

    const json = (await response.json()) as ProxmoxResponse<T>;
    return json.data;
  }

  // Connection test
  async testConnection(): Promise<boolean> {
    try {
      await this.request<unknown>("GET", "/version");
      return true;
    } catch {
      return false;
    }
  }

  // Node operations
  async getNodes(): Promise<Node[]> {
    return this.request<Node[]>("GET", "/nodes");
  }

  async getNodeStatus(node: string): Promise<Node> {
    return this.request<Node>("GET", `/nodes/${node}/status`);
  }

  // VM operations
  async getVMs(node?: string): Promise<VM[]> {
    if (node) {
      return this.request<VM[]>("GET", `/nodes/${node}/qemu`);
    }

    // Get VMs from all nodes
    const nodes = await this.getNodes();
    const vmPromises = nodes.map((n) =>
      this.request<VM[]>("GET", `/nodes/${n.node}/qemu`).then((vms) =>
        vms.map((vm) => ({ ...vm, node: n.node }))
      )
    );

    const results = await Promise.all(vmPromises);
    return results.flat();
  }

  async getVM(node: string, vmid: number): Promise<VM> {
    const vms = await this.request<VM[]>("GET", `/nodes/${node}/qemu`);
    const vm = vms.find((v) => v.vmid === vmid);
    if (!vm) {
      throw new Error(`VM ${vmid} not found on node ${node}`);
    }
    return { ...vm, node };
  }

  async startVM(node: string, vmid: number): Promise<string> {
    return this.request<string>("POST", `/nodes/${node}/qemu/${vmid}/status/start`);
  }

  async stopVM(node: string, vmid: number): Promise<string> {
    return this.request<string>("POST", `/nodes/${node}/qemu/${vmid}/status/stop`);
  }

  async shutdownVM(node: string, vmid: number): Promise<string> {
    return this.request<string>("POST", `/nodes/${node}/qemu/${vmid}/status/shutdown`);
  }

  async rebootVM(node: string, vmid: number): Promise<string> {
    return this.request<string>("POST", `/nodes/${node}/qemu/${vmid}/status/reboot`);
  }

  async getVMConfig(node: string, vmid: number): Promise<VMConfig> {
    return this.request<VMConfig>("GET", `/nodes/${node}/qemu/${vmid}/config`);
  }

  // Container operations
  async getContainers(node?: string): Promise<Container[]> {
    if (node) {
      return this.request<Container[]>("GET", `/nodes/${node}/lxc`);
    }

    // Get containers from all nodes
    const nodes = await this.getNodes();
    const containerPromises = nodes.map((n) =>
      this.request<Container[]>("GET", `/nodes/${n.node}/lxc`).then((containers) =>
        containers.map((c) => ({ ...c, node: n.node }))
      )
    );

    const results = await Promise.all(containerPromises);
    return results.flat();
  }

  async getContainer(node: string, vmid: number): Promise<Container> {
    const containers = await this.request<Container[]>("GET", `/nodes/${node}/lxc`);
    const container = containers.find((c) => c.vmid === vmid);
    if (!container) {
      throw new Error(`Container ${vmid} not found on node ${node}`);
    }
    return { ...container, node };
  }

  async startContainer(node: string, vmid: number): Promise<string> {
    return this.request<string>("POST", `/nodes/${node}/lxc/${vmid}/status/start`);
  }

  async stopContainer(node: string, vmid: number): Promise<string> {
    return this.request<string>("POST", `/nodes/${node}/lxc/${vmid}/status/stop`);
  }

  async shutdownContainer(node: string, vmid: number): Promise<string> {
    return this.request<string>("POST", `/nodes/${node}/lxc/${vmid}/status/shutdown`);
  }

  async rebootContainer(node: string, vmid: number): Promise<string> {
    return this.request<string>("POST", `/nodes/${node}/lxc/${vmid}/status/reboot`);
  }

  async getContainerConfig(node: string, vmid: number): Promise<ContainerConfig> {
    return this.request<ContainerConfig>("GET", `/nodes/${node}/lxc/${vmid}/config`);
  }

  async getContainerInterfaces(node: string, vmid: number): Promise<NetworkInterface[]> {
    return this.request<NetworkInterface[]>("GET", `/nodes/${node}/lxc/${vmid}/interfaces`);
  }

  async updateContainerConfig(
    node: string,
    vmid: number,
    config: Partial<ContainerConfigUpdate>
  ): Promise<string> {
    return this.request<string>("PUT", `/nodes/${node}/lxc/${vmid}/config`, config as Record<string, unknown>);
  }

  // Storage operations
  async getStorage(node?: string): Promise<Storage[]> {
    if (node) {
      return this.request<Storage[]>("GET", `/nodes/${node}/storage`);
    }

    const nodes = await this.getNodes();
    const storagePromises = nodes.map((n) =>
      this.request<Storage[]>("GET", `/nodes/${n.node}/storage`)
    );

    const results = await Promise.all(storagePromises);
    // Deduplicate shared storage
    const seen = new Set<string>();
    return results.flat().filter((s) => {
      if (seen.has(s.storage)) return false;
      seen.add(s.storage);
      return true;
    });
  }

  // Cluster resources
  async getResources(): Promise<ResourceSummary[]> {
    return this.request<ResourceSummary[]>("GET", "/cluster/resources");
  }

  // Tasks
  async getTasks(node: string): Promise<Task[]> {
    return this.request<Task[]>("GET", `/nodes/${node}/tasks`);
  }

  async getTaskStatus(node: string, upid: string): Promise<Task> {
    return this.request<Task>("GET", `/nodes/${node}/tasks/${encodeURIComponent(upid)}/status`);
  }
}

// Singleton instance
let client: ProxmoxClient | null = null;

export function initClient(config: ProxmuxConfig): ProxmoxClient {
  client = new ProxmoxClient(config);
  return client;
}

export function getClient(): ProxmoxClient {
  if (!client) {
    throw new Error("Proxmox client not initialized. Call initClient first.");
  }
  return client;
}
