import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";

export interface ProxmuxConfig {
  host: string;
  user: string;
  tokenId: string;
  tokenSecret: string;
  skipTlsVerify?: boolean;
}

export interface SessionData {
  ticket: string;
  csrfToken: string;
  username: string;
  timestamp: number;
}

const CONFIG_DIR = join(homedir(), ".config", "proxmux");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const SESSION_FILE = join(CONFIG_DIR, "session.json");

const SESSION_MAX_AGE_MS = 100 * 60 * 1000;

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
  const skipTlsVerify = process.env.PROXMOX_SKIP_TLS_VERIFY === "1" ||
                        process.env.PROXMOX_SKIP_TLS_VERIFY?.toLowerCase() === "true";

  if (host && user && tokenId && tokenSecret) {
    return { host, user, tokenId, tokenSecret, skipTlsVerify };
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
      return {
        host: config.host,
        user: config.user,
        tokenId: config.tokenId,
        tokenSecret: config.tokenSecret,
        skipTlsVerify: config.skipTlsVerify ?? false,
      };
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

export function getSessionPath(): string {
  return SESSION_FILE;
}

export function loadSession(): SessionData | null {
  if (!existsSync(SESSION_FILE)) {
    return null;
  }

  try {
    const content = readFileSync(SESSION_FILE, "utf-8");
    const session = JSON.parse(content) as SessionData;

    if (session.ticket && session.csrfToken && session.username && session.timestamp) {
      return session;
    }

    return null;
  } catch {
    return null;
  }
}

export function isSessionValid(session: SessionData | null): boolean {
  if (!session) return false;
  const age = Date.now() - session.timestamp;
  return age < SESSION_MAX_AGE_MS;
}

export function saveSession(session: SessionData): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), { mode: 0o600 });
}

export function clearSession(): void {
  if (existsSync(SESSION_FILE)) {
    unlinkSync(SESSION_FILE);
  }
}
