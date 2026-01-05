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

// Writable subset of ContainerConfig for updates
export interface ContainerConfigUpdate {
  // Resources
  memory?: number;      // MB
  swap?: number;        // MB
  cores?: number;
  cpulimit?: number;    // 0-128 (0 = unlimited)
  cpuunits?: number;    // 0-500000

  // General
  hostname?: string;
  description?: string;

  // Options
  onboot?: number;      // 0 or 1
  protection?: number;  // 0 or 1
  startup?: string;     // order=N,up=N,down=N
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

// Storage content item (ISO, templates, etc.)
export interface StorageContent {
  volid: string;
  content: string;
  format: string;
  size: number;
  ctime?: number;
  filename?: string;
}

// Template types for LXC creation
export interface Template {
  volid: string;
  format: string;
  size: number;
  content: string;
}

export interface AvailableTemplate {
  template: string;
  type: string;
  package: string;
  version: string;
  os: string;
  section: string;
  headline: string;
  description?: string;
  maintainer?: string;
  location?: string;
  md5sum?: string;
  sha512sum?: string;
  infopage?: string;
}

// LXC creation configuration
export interface LXCCreateConfig {
  vmid: number;
  hostname: string;
  ostemplate: string;
  password?: string;
  "ssh-public-keys"?: string;
  cores?: number;
  memory?: number;
  swap?: number;
  rootfs: string; // format: "storage:size" e.g., "local-lvm:8"
  net0?: string; // format: "name=eth0,bridge=vmbr0,ip=dhcp" or with static IP
  nameserver?: string;
  searchdomain?: string;
  unprivileged?: boolean;
  start?: boolean;
  features?: string; // e.g., "nesting=1"
  onboot?: boolean;
}

// Network configuration for the LXC wizard
export interface LXCNetworkConfig {
  bridge: string;
  ipType: "dhcp" | "static";
  ip?: string;
  gateway?: string;
  ip6Type?: "auto" | "dhcp" | "static" | "none";
  ip6?: string;
  gateway6?: string;
  firewall?: boolean;
}

// VM Creation types
export type VMOsType =
  | "l26"      // Linux 2.6+/3.x/4.x/5.x/6.x kernel
  | "l24"      // Linux 2.4 kernel
  | "win11"    // Windows 11
  | "win10"    // Windows 10
  | "win8"     // Windows 8.x
  | "win7"     // Windows 7
  | "wvista"   // Windows Vista
  | "wxp"      // Windows XP
  | "w2k"      // Windows 2000
  | "w2k8"     // Windows 2008
  | "w2k3"     // Windows 2003
  | "w2k12"    // Windows 2012
  | "w2k16"    // Windows 2016
  | "w2k19"    // Windows 2019
  | "w2k22"    // Windows 2022
  | "solaris"  // Solaris kernel
  | "other";   // Other OS

export type VMDiskFormat = "qcow2" | "raw" | "vmdk";

export type VMNetModel = "virtio" | "e1000" | "rtl8139" | "vmxnet3";

export interface VMCreateDisk {
  storage: string;
  size: number;  // Size in GB
  format?: VMDiskFormat;
}

export interface VMCreateNetwork {
  bridge: string;
  model?: VMNetModel;
  macaddr?: string;
  firewall?: boolean;
}

export interface VMCreateConfig {
  vmid: number;
  name: string;
  iso?: string;           // ISO volume ID (e.g., "local:iso/ubuntu.iso")
  ostype: VMOsType;
  cores: number;
  sockets: number;
  memory: number;         // Memory in MB
  disk: VMCreateDisk;
  network: VMCreateNetwork;
  boot?: string;          // Boot order (e.g., "order=scsi0;ide2;net0")
  start?: boolean;        // Start after creation
  cpu?: string;           // CPU type (e.g., "host", "kvm64")
  bios?: "seabios" | "ovmf";
  machine?: string;       // Machine type (e.g., "q35")
}
