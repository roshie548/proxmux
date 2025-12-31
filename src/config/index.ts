import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

export interface ProxmuxConfig {
  host: string;
  user: string;
  tokenId: string;
  tokenSecret: string;
}

const CONFIG_DIR = join(homedir(), ".config", "proxmux");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function loadConfig(): ProxmuxConfig | null {
  // Environment variables take precedence
  const envConfig = loadFromEnv();
  if (envConfig) {
    return envConfig;
  }

  // Fall back to config file
  return loadFromFile();
}

function loadFromEnv(): ProxmuxConfig | null {
  const host = process.env.PROXMOX_HOST;
  const user = process.env.PROXMOX_USER;
  const tokenId = process.env.PROXMOX_TOKEN_ID;
  const tokenSecret = process.env.PROXMOX_TOKEN_SECRET;

  if (host && user && tokenId && tokenSecret) {
    return { host, user, tokenId, tokenSecret };
  }

  return null;
}

function loadFromFile(): ProxmuxConfig | null {
  if (!existsSync(CONFIG_FILE)) {
    return null;
  }

  try {
    const content = readFileSync(CONFIG_FILE, "utf-8");
    const config = JSON.parse(content) as ProxmuxConfig;

    if (config.host && config.user && config.tokenId && config.tokenSecret) {
      return config;
    }

    return null;
  } catch {
    return null;
  }
}

export function saveConfig(config: ProxmuxConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function isConfigured(): boolean {
  return loadConfig() !== null;
}
