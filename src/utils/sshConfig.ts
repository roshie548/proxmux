import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface SSHConfigEntry {
  host: string;
  hostName?: string;
  user?: string;
  port?: number;
}

export function getSSHConfigPath(): string {
  return join(homedir(), ".ssh", "config");
}

export function parseSSHConfig(configPath?: string): SSHConfigEntry[] {
  const path = configPath ?? getSSHConfigPath();

  if (!existsSync(path)) {
    return [];
  }

  try {
    const content = readFileSync(path, "utf-8");
    return parseSSHConfigContent(content);
  } catch {
    return [];
  }
}

export function parseSSHConfigContent(content: string): SSHConfigEntry[] {
  const entries: SSHConfigEntry[] = [];
  let currentEntry: SSHConfigEntry | null = null;

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const hostMatch = trimmed.match(/^host\s+(.+)$/i);
    if (hostMatch && hostMatch[1]) {
      if (currentEntry) {
        entries.push(currentEntry);
      }

      const hostValue = hostMatch[1].trim();

      if (hostValue.includes("*") || hostValue.includes("?")) {
        currentEntry = null;
        continue;
      }

      if (hostValue.includes(" ") || hostValue.includes("\t")) {
        currentEntry = null;
        continue;
      }

      currentEntry = { host: hostValue };
      continue;
    }

    if (!currentEntry) {
      continue;
    }

    const hostNameMatch = trimmed.match(/^hostname\s+(.+)$/i);
    if (hostNameMatch && hostNameMatch[1]) {
      currentEntry.hostName = hostNameMatch[1].trim();
      continue;
    }

    const userMatch = trimmed.match(/^user\s+(.+)$/i);
    if (userMatch && userMatch[1]) {
      currentEntry.user = userMatch[1].trim();
      continue;
    }

    const portMatch = trimmed.match(/^port\s+(\d+)$/i);
    if (portMatch && portMatch[1]) {
      const port = parseInt(portMatch[1], 10);
      if (!isNaN(port) && port > 0 && port <= 65535) {
        currentEntry.port = port;
      }
      continue;
    }
  }

  if (currentEntry) {
    entries.push(currentEntry);
  }

  return entries;
}

export function findMatchingSSHConfigs(
  entries: SSHConfigEntry[],
  targetHost: string
): SSHConfigEntry[] {
  const target = targetHost.toLowerCase();

  return entries.filter((entry) => {
    if (entry.hostName) {
      return entry.hostName.toLowerCase() === target;
    }
    return entry.host.toLowerCase() === target;
  });
}

export function formatSSHConfigEntry(entry: SSHConfigEntry): string {
  const details: string[] = [];

  if (entry.user) {
    details.push(`User: ${entry.user}`);
  }
  if (entry.port) {
    details.push(`Port: ${entry.port}`);
  }

  if (details.length > 0) {
    return `${entry.host} (${details.join(", ")})`;
  }
  return entry.host;
}
