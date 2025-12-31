export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);

  return `${value.toFixed(1)} ${units[i]}`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  return parts.join(" ");
}

export function formatCPU(cpu: number, maxcpu: number): string {
  const percent = maxcpu > 0 ? (cpu / maxcpu) * 100 : 0;
  return `${percent.toFixed(1)}% (${maxcpu} cores)`;
}

export function formatMemory(mem: number, maxmem: number): string {
  const percent = maxmem > 0 ? (mem / maxmem) * 100 : 0;
  return `${formatBytes(mem)} / ${formatBytes(maxmem)} (${percent.toFixed(1)}%)`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length - 1) + "…";
}

export function padRight(str: string, length: number): string {
  return str.padEnd(length);
}

export function padLeft(str: string, length: number): string {
  return str.padStart(length);
}
