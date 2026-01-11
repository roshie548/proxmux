#!/usr/bin/env bun
import React from "react";
import { render, Box, Text } from "ink";
import { App } from "./app.tsx";
import { EditModeProvider } from "./context/EditModeContext.tsx";
import { loadConfig, saveConfig, getConfigPath, type ProxmuxConfig } from "./config/index.ts";
import { initClient } from "./api/client.ts";
import { parseSSHConfig, findMatchingSSHConfigs, formatSSHConfigEntry } from "./utils/sshConfig.ts";
import packageJson from "../package.json";

(async () => {
  const args = process.argv.slice(2);

  if (args.includes("--version") || args.includes("-v")) {
    console.log(`proxmux v${packageJson.version}`);
    process.exit(0);
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
proxmux - Terminal UI for Proxmox VE management

Usage:
  proxmux              Launch the TUI
  proxmux --config     Configure Proxmox connection
  proxmux --version    Show version number
  proxmux --help       Show this help message

Keyboard shortcuts:
  1-4         Switch views (Dashboard, VMs, Containers, Storage)
  j/k or ↑/↓  Navigate lists
  Enter       Select item
  s           Start VM/container
  x           Stop VM/container
  R           Reboot VM/container
  r           Refresh current view
  q           Quit

Configuration:
  Config file: ${getConfigPath()}

  Environment variables (override config file):
    PROXMOX_HOST         Proxmox host URL (e.g., https://192.168.1.100:8006)
    PROXMOX_USER         User (e.g., root@pam)
    PROXMOX_TOKEN_ID     API token name (just the name, e.g., proxmux)
    PROXMOX_TOKEN_SECRET API token secret

  SSH settings for container console (optional):
    PROXMOX_SSH_HOST     SSH host or alias (default: Proxmox hostname)
    PROXMOX_SSH_USER     SSH user (default: root)
    PROXMOX_SSH_PORT     SSH port (default: 22)
`);
    process.exit(0);
  }

  if (args.includes("--config")) {
    console.log("Configure Proxmox connection\n");

    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (prompt: string): Promise<string> =>
      new Promise((resolve) => rl.question(prompt, resolve));

    try {
      const host = await question("Proxmox host URL (e.g., https://192.168.1.100:8006): ");
      const user = await question("User (e.g., root@pam): ");
      let tokenId = await question("API token name (e.g., proxmux): ");

      if (tokenId.includes("!")) {
        const parts = tokenId.split("!");
        tokenId = parts[parts.length - 1] || tokenId;
        console.log(`  (Extracted token name: ${tokenId})`);
      }

      const tokenSecret = await question("API token secret: ");

      let sshHost: string | undefined;
      let sshUser: string | undefined;
      let sshPort: number | undefined;

      let proxmoxHostname: string;
      try {
        proxmoxHostname = new URL(host).hostname;
      } catch {
        proxmoxHostname = host;
      }

      const sshEntries = parseSSHConfig();
      const matches = findMatchingSSHConfigs(sshEntries, proxmoxHostname);

      console.log("\nSSH Settings (for container console):");

      if (matches.length === 1 && matches[0]) {
        const match = matches[0];
        console.log("  Found matching SSH config:");
        console.log(`    Host: ${match.host}`);
        if (match.user) console.log(`    User: ${match.user}`);
        if (match.port) console.log(`    Port: ${match.port}`);
        console.log();

        const useMatch = await question("  Use this configuration? (Y/n): ");
        if (useMatch.toLowerCase() !== "n") {
          sshHost = match.host;
        } else {
          console.log();
          const manualUser = await question("  SSH user (default: root): ");
          const manualPort = await question("  SSH port (default: 22): ");
          if (manualUser) sshUser = manualUser;
          if (manualPort) sshPort = parseInt(manualPort, 10);
        }
      } else if (matches.length > 1) {
        console.log("  Found multiple matching SSH configs:");
        matches.forEach((match, i) => {
          console.log(`    ${i + 1}) ${formatSSHConfigEntry(match)}`);
        });
        console.log();

        const selection = await question(`  Select configuration (1-${matches.length}), or press Enter to configure manually: `);
        const selectedIndex = parseInt(selection, 10) - 1;
        const selectedMatch = matches[selectedIndex];

        if (selectedIndex >= 0 && selectedIndex < matches.length && selectedMatch) {
          sshHost = selectedMatch.host;
        } else {
          console.log();
          const manualUser = await question("  SSH user (default: root): ");
          const manualPort = await question("  SSH port (default: 22): ");
          if (manualUser) sshUser = manualUser;
          if (manualPort) sshPort = parseInt(manualPort, 10);
        }
      } else {
        console.log("  No matching SSH config found. Configure manually (press Enter for defaults):");
        const manualUser = await question("  SSH user (default: root): ");
        const manualPort = await question("  SSH port (default: 22): ");
        if (manualUser) sshUser = manualUser;
        if (manualPort) sshPort = parseInt(manualPort, 10);
      }

      const config: ProxmuxConfig = {
        host, user, tokenId, tokenSecret,
        ...(sshHost && { sshHost }),
        ...(sshUser && { sshUser }),
        ...(sshPort && { sshPort }),
      };
      saveConfig(config);

      console.log(`\nConfiguration saved to ${getConfigPath()}`);
    } finally {
      rl.close();
    }
    process.exit(0);
  }

  // Main application
  const config = loadConfig();

  if (!config) {
    console.error(`
No configuration found!

Please configure proxmux by running:
  proxmux --config

Or set environment variables:
  PROXMOX_HOST=https://your-proxmox:8006
  PROXMOX_USER=root@pam
  PROXMOX_TOKEN_ID=your-token-name
  PROXMOX_TOKEN_SECRET=your-token-secret
`);
    process.exit(1);
  }

  initClient(config);

  const { waitUntilExit } = render(
    <EditModeProvider>
      <App config={config} />
    </EditModeProvider>
  );

  await waitUntilExit();
})();
