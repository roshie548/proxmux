#!/usr/bin/env bun

import React from "react";
import { render, Box, Text } from "ink";
import { App } from "./app.tsx";
import { EditModeProvider } from "./context/EditModeContext.tsx";
import { InkProvider } from "./context/InkContext.tsx";
import { ModalProvider } from "./context/ModalContext.tsx";
import { loadConfig, saveConfig, getConfigPath, type ProxmuxConfig } from "./config/index.ts";
import { initClient } from "./api/client.ts";
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
    PROXMOX_HOST            Proxmox host URL (e.g., https://192.168.1.100:8006)
    PROXMOX_USER            User (e.g., root@pam)
    PROXMOX_TOKEN_ID        API token name (just the name, e.g., proxmux)
    PROXMOX_TOKEN_SECRET    API token secret
    PROXMOX_SKIP_TLS_VERIFY Set to "1" to skip TLS cert verification (for self-signed certs)

Console access:
  Console requires password authentication (API tokens don't work).
  You'll be prompted for your password when first accessing console.
  The session is cached locally and expires after ~2 hours.
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

      // Parse full Token ID format (user@realm!tokenname) if provided
      if (tokenId.includes("!")) {
        const parts = tokenId.split("!");
        tokenId = parts[parts.length - 1] || tokenId;
        console.log(`  (Extracted token name: ${tokenId})`);
      }

      const tokenSecret = await question("API token secret: ");

      console.log("\n  Note: Proxmox uses self-signed certs by default.");
      console.log("  If you haven't installed a trusted certificate, answer 'y'.\n");
      const skipTlsAnswer = await question("Skip TLS certificate verification? (y/N): ");
      const skipTlsVerify = skipTlsAnswer.toLowerCase() === "y";

      const config: ProxmuxConfig = { host, user, tokenId, tokenSecret, skipTlsVerify };
      saveConfig(config);

      console.log(`\nConfiguration saved to ${getConfigPath()}`);
      if (skipTlsVerify) {
        console.log("  (TLS verification disabled - suitable for self-signed certs)");
      }
    } finally {
      rl.close();
    }
    process.exit(0);
  }

  // Main application
  const config = loadConfig();

  // Apply TLS setting based on config (must be set before any connections)
  if (config?.skipTlsVerify) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

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

  let clearFn: () => void = () => {};

  const { waitUntilExit, clear } = render(
    <EditModeProvider>
      <ModalProvider>
        <InkProvider clearScreen={() => clearFn()}>
          <App config={config} />
        </InkProvider>
      </ModalProvider>
    </EditModeProvider>
  );

  clearFn = clear;

  await waitUntilExit();
})();
