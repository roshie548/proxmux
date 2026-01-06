import { homedir } from "os";
import { join } from "path";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  chmodSync,
  statSync,
} from "fs";
import { execSync } from "child_process";

export interface ProxmuxConfig {
  host: string;
  user: string;
  tokenId: string;
  tokenSecret: string;
}

const CONFIG_DIR = join(homedir(), ".config", "proxmux");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

// Windows ACL helper using icacls
function setWindowsAcl(filePath: string): void {
  try {
    // Remove inherited permissions, grant only current user full control
    execSync(`icacls "${filePath}" /inheritance:r /grant:r "%USERNAME%:(F)"`, {
      stdio: "ignore",
      windowsHide: true,
    });
  } catch {
    // Silently fail - better to have config than crash
  }
}

// Secure file permission helpers
function ensureSecureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  }
  // Always set permissions in case dir existed with wrong permissions
  if (process.platform === "win32") {
    setWindowsAcl(dirPath);
  } else {
    chmodSync(dirPath, 0o700);
  }
}

function writeSecureFile(filePath: string, content: string): void {
  writeFileSync(filePath, content, { mode: 0o600 });
  // Explicit permission setting handles overwrites and umask issues
  if (process.platform === "win32") {
    setWindowsAcl(filePath);
  } else {
    chmodSync(filePath, 0o600);
  }
}

function fixConfigPermissions(): void {
  try {
    if (process.platform === "win32") {
      // On Windows, always apply ACLs (can't easily detect insecure state)
      if (existsSync(CONFIG_DIR)) setWindowsAcl(CONFIG_DIR);
      if (existsSync(CONFIG_FILE)) setWindowsAcl(CONFIG_FILE);
    } else {
      // Unix: check and fix if needed
      if (existsSync(CONFIG_DIR)) {
        const dirMode = statSync(CONFIG_DIR).mode & 0o777;
        if (dirMode !== 0o700) {
          chmodSync(CONFIG_DIR, 0o700);
          console.log(`Fixed insecure permissions on ${CONFIG_DIR}`);
        }
      }
      if (existsSync(CONFIG_FILE)) {
        const fileMode = statSync(CONFIG_FILE).mode & 0o777;
        if (fileMode !== 0o600) {
          chmodSync(CONFIG_FILE, 0o600);
          console.log(`Fixed insecure permissions on ${CONFIG_FILE}`);
        }
      }
    }
  } catch {
    // Silently ignore permission check failures
  }
}

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
  // Fix insecure permissions on existing config files
  fixConfigPermissions();

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
  ensureSecureDir(CONFIG_DIR);
  writeSecureFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function isConfigured(): boolean {
  return loadConfig() !== null;
}
