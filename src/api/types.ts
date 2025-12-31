// Proxmox API response wrapper
export interface ProxmoxResponse<T> {
  data: T;
}

// Node/Cluster types
export interface Node {
  node: string;
  status: "online" | "offline";
  cpu: number;
  maxcpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
}

export interface ClusterStatus {
  nodes: number;
  quorate: number;
  version: number;
}

// VM types
export interface VM {
  vmid: number;
  name: string;
  status: "running" | "stopped" | "paused";
  node: string;
  cpu: number;
  cpus: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
  template: boolean;
}

export interface VMConfig {
  name?: string;
  description?: string;
  memory?: number;
  cores?: number;
  sockets?: number;
  ostype?: string;
  boot?: string;
  net0?: string;
  net1?: string;
  ide0?: string;
  ide2?: string;
  scsi0?: string;
  tags?: string;
  onboot?: number;
  agent?: string;
}

export interface ContainerConfig {
  hostname?: string;
  description?: string;
  memory?: number;
  swap?: number;
  cores?: number;
  cpulimit?: number;
  cpuunits?: number;
  ostype?: string;
  arch?: string;
  net0?: string;
  net1?: string;
  net2?: string;
  net3?: string;
  rootfs?: string;
  tags?: string;
  onboot?: number;
  startup?: string;
  unprivileged?: number;
  protection?: number;
  features?: string;
  cmode?: "tty" | "console" | "shell";
  lock?: string;
  template?: number;
}

// Container (LXC) types
export interface Container {
  vmid: number;
  name: string;
  status: "running" | "stopped";
  node: string;
  cpu: number;
  cpus: number;
  mem: number;
  maxmem: number;
  swap?: number;
  maxswap?: number;
  disk: number;
  maxdisk: number;
  uptime: number;
  template: boolean;
}

// Storage types
export interface Storage {
  storage: string;
  type: string;
  content: string;
  active: number;
  enabled: number;
  shared: number;
  used: number;
  avail: number;
  total: number;
}

// Task types
export interface Task {
  upid: string;
  node: string;
  pid: number;
  starttime: number;
  type: string;
  user: string;
  status?: string;
}

// Resource summary
export interface ResourceSummary {
  type: "vm" | "lxc" | "storage" | "node";
  id: string;
  node: string;
  status: string;
  name?: string;
  cpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
}

// Network interface (from container/VM)
export interface NetworkInterface {
  name: string;
  hwaddr?: string;
  "inet"?: string;
  "inet6"?: string;
}
