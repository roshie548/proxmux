#!/usr/bin/env bun
import React from "react";
import { render, Box, Text } from "ink";
import { App } from "./app.tsx";
import { EditModeProvider } from "./context/EditModeContext.tsx";
import { loadConfig, saveConfig, getConfigPath, type ProxmuxConfig } from "./config/index.ts";
import { initClient } from "./api/client.ts";

(async () => {
  const args = process.argv.slice(2);

  // Help command
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
proxmux - Terminal UI for Proxmox VE management

Usage:
  proxmux              Launch the TUI
  proxmux --config     Configure Proxmox connection
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
    PROXMOX_TOKEN_ID     API token ID
    PROXMOX_TOKEN_SECRET API token secret
`);
    process.exit(0);
  }

  // Config command
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
      const tokenId = await question("API token ID: ");
      const tokenSecret = await question("API token secret: ");

      const config: ProxmuxConfig = { host, user, tokenId, tokenSecret };
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
  PROXMOX_TOKEN_ID=your-token-id
  PROXMOX_TOKEN_SECRET=your-token-secret
`);
    process.exit(1);
  }

  // Initialize API client before rendering
  initClient(config);

  // Render the app
  const { waitUntilExit } = render(
    <EditModeProvider>
      <App config={config} />
    </EditModeProvider>
  );

  await waitUntilExit();
})();
