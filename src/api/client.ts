import type { ProxmuxConfig, SessionData } from "../config/index.ts";
import { loadSession, saveSession, isSessionValid } from "../config/index.ts";
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
  TermProxyResponse,
} from "./types.ts";

interface SessionTicketResponse {
  ticket: string;
  CSRFPreventionToken: string;
  username: string;
}

export class ProxmoxClient {
  private baseUrl: string;
  private authHeader: string;
  private user: string;

  private sessionTicket?: string;
  private csrfToken?: string;

  constructor(config: ProxmuxConfig) {
    this.baseUrl = config.host.replace(/\/$/, "");
    this.authHeader = `PVEAPIToken=${config.user}!${config.tokenId}=${config.tokenSecret}`;
    this.user = config.user;

    this.loadSessionFromDisk();
  }

  private loadSessionFromDisk(): void {
    const session = loadSession();
    if (isSessionValid(session)) {
      this.sessionTicket = session!.ticket;
      this.csrfToken = session!.csrfToken;
    }
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
    return this.request<string>(
      "POST",
      `/nodes/${node}/qemu/${vmid}/status/start`
    );
  }

  async stopVM(node: string, vmid: number): Promise<string> {
    return this.request<string>(
      "POST",
      `/nodes/${node}/qemu/${vmid}/status/stop`
    );
  }

  async shutdownVM(node: string, vmid: number): Promise<string> {
    return this.request<string>(
      "POST",
      `/nodes/${node}/qemu/${vmid}/status/shutdown`
    );
  }

  async rebootVM(node: string, vmid: number): Promise<string> {
    return this.request<string>(
      "POST",
      `/nodes/${node}/qemu/${vmid}/status/reboot`
    );
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
      this.request<Container[]>("GET", `/nodes/${n.node}/lxc`).then(
        (containers) => containers.map((c) => ({ ...c, node: n.node }))
      )
    );

    const results = await Promise.all(containerPromises);
    return results.flat();
  }

  async getContainer(node: string, vmid: number): Promise<Container> {
    const containers = await this.request<Container[]>(
      "GET",
      `/nodes/${node}/lxc`
    );
    const container = containers.find((c) => c.vmid === vmid);
    if (!container) {
      throw new Error(`Container ${vmid} not found on node ${node}`);
    }
    return { ...container, node };
  }

  async startContainer(node: string, vmid: number): Promise<string> {
    return this.request<string>(
      "POST",
      `/nodes/${node}/lxc/${vmid}/status/start`
    );
  }

  async stopContainer(node: string, vmid: number): Promise<string> {
    return this.request<string>(
      "POST",
      `/nodes/${node}/lxc/${vmid}/status/stop`
    );
  }

  async shutdownContainer(node: string, vmid: number): Promise<string> {
    return this.request<string>(
      "POST",
      `/nodes/${node}/lxc/${vmid}/status/shutdown`
    );
  }

  async rebootContainer(node: string, vmid: number): Promise<string> {
    return this.request<string>(
      "POST",
      `/nodes/${node}/lxc/${vmid}/status/reboot`
    );
  }

  async getContainerConfig(
    node: string,
    vmid: number
  ): Promise<ContainerConfig> {
    return this.request<ContainerConfig>(
      "GET",
      `/nodes/${node}/lxc/${vmid}/config`
    );
  }

  async getContainerInterfaces(
    node: string,
    vmid: number
  ): Promise<NetworkInterface[]> {
    return this.request<NetworkInterface[]>(
      "GET",
      `/nodes/${node}/lxc/${vmid}/interfaces`
    );
  }

  async updateContainerConfig(
    node: string,
    vmid: number,
    config: Partial<ContainerConfigUpdate>
  ): Promise<string> {
    return this.request<string>(
      "PUT",
      `/nodes/${node}/lxc/${vmid}/config`,
      config as Record<string, unknown>
    );
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
    return this.request<Task>(
      "GET",
      `/nodes/${node}/tasks/${encodeURIComponent(upid)}/status`
    );
  }

  createContainerTermProxy(
    node: string,
    vmid: number
  ): Promise<TermProxyResponse> {
    const { ticket } = this.getSessionTicket();
    return this.requestWithSession<TermProxyResponse>(
      "POST",
      `/nodes/${node}/lxc/${vmid}/termproxy`,
      ticket
    );
  }

  createVMTermProxy(node: string, vmid: number): Promise<TermProxyResponse> {
    const { ticket } = this.getSessionTicket();
    return this.requestWithSession<TermProxyResponse>(
      "POST",
      `/nodes/${node}/qemu/${vmid}/termproxy`,
      ticket
    );
  }

  private async requestWithSession<T>(
    method: string,
    path: string,
    sessionTicket: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}/api2/json${path}`;

    const headers: Record<string, string> = {
      Cookie: `PVEAuthCookie=${sessionTicket}`,
    };

    if (this.csrfToken) {
      headers["CSRFPreventionToken"] = this.csrfToken;
    }

    const options: RequestInit = {
      method,
      headers,
      // @ts-ignore - Bun supports this option
      tls: {
        rejectUnauthorized: false,
      },
    };

    if (body) {
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
      throw new Error(`Proxmox API error: ${response.status} - ${text}`);
    }

    const json = (await response.json()) as ProxmoxResponse<T>;
    return json.data;
  }

  getTerminalWebSocketUrl(
    node: string,
    vmid: number,
    port: string,
    ticket: string,
    type: "lxc" | "qemu"
  ): string {
    const url = new URL(this.baseUrl);
    const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
    const encodedTicket = encodeURIComponent(ticket);
    return `${wsProtocol}//${url.host}/api2/json/nodes/${node}/${type}/${vmid}/vncwebsocket?port=${port}&vncticket=${encodedTicket}`;
  }

  getOrigin(): string {
    return this.baseUrl;
  }

  getUser(): string {
    return this.user;
  }

  hasValidSession(): boolean {
    if (this.sessionTicket) {
      return true;
    }

    const session = loadSession();
    if (isSessionValid(session)) {
      this.sessionTicket = session!.ticket;
      this.csrfToken = session!.csrfToken;
      return true;
    }

    return false;
  }

  async authenticateWithPassword(password: string): Promise<void> {
    const url = `${this.baseUrl}/api2/json/access/ticket`;
    const params = new URLSearchParams();
    params.append("username", this.user);
    params.append("password", password);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      // @ts-ignore - Bun supports this option for SSL verification bypass
      tls: {
        rejectUnauthorized: false,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401) {
        throw new Error("Invalid username or password");
      }
      throw new Error(`Authentication failed: ${response.status} - ${text}`);
    }

    const json = (await response.json()) as { data: SessionTicketResponse };
    this.sessionTicket = json.data.ticket;
    this.csrfToken = json.data.CSRFPreventionToken;

    const sessionData: SessionData = {
      ticket: this.sessionTicket,
      csrfToken: this.csrfToken,
      username: this.user,
      timestamp: Date.now(),
    };
    saveSession(sessionData);
  }

  getSessionTicket(): { ticket: string; csrfToken: string } {
    if (!this.hasValidSession()) {
      throw new Error("No valid session. Authentication required.");
    }
    return { ticket: this.sessionTicket!, csrfToken: this.csrfToken! };
  }

  getSessionCookie(): string {
    const { ticket } = this.getSessionTicket();
    return `PVEAuthCookie=${ticket}`;
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
