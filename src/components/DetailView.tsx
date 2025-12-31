import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { StatusBadge } from "./common/StatusBadge.tsx";
import { ProgressBar } from "./common/ProgressBar.tsx";
import { Spinner } from "./common/Spinner.tsx";
import { formatBytes, formatUptime } from "../utils/format.ts";
import { getClient } from "../api/client.ts";
import type { VMConfig, ContainerConfig, NetworkInterface } from "../api/types.ts";

interface DetailViewProps {
  type: "vm" | "container";
  item: {
    vmid: number;
    name: string;
    status: "running" | "stopped" | "paused";
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
  };
  onBack: () => void;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onReboot: () => Promise<void>;
  onConsole?: (vmid: number, node: string) => void;
}

type Action = "start" | "stop" | "reboot" | "console";
type PendingConfirm = Action | null;
type Tab = "summary" | "options";

function parseNetworkInfo(netConfig?: string): { ip?: string; mac?: string; bridge?: string } {
  if (!netConfig) return {};
  const parts = netConfig.split(",");
  const result: { ip?: string; mac?: string; bridge?: string } = {};

  for (const part of parts) {
    if (part.startsWith("ip=")) {
      result.ip = part.substring(3).split("/")[0];
    } else if (part.includes("=")) {
      const [key, value] = part.split("=");
      if (key === "bridge") result.bridge = value;
      if (value?.match(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/)) {
        result.mac = value;
      }
    } else if (part.match(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/)) {
      result.mac = part;
    }
  }
  return result;
}

function parseFeatures(features: string | undefined): string[] {
  if (!features) return [];
  const enabled: string[] = [];
  const parts = features.split(",");
  for (const part of parts) {
    const segments = part.split("=");
    const key = segments[0];
    const value = segments[1];
    if (key && value === "1") {
      enabled.push(key);
    }
  }
  return enabled;
}

function parseStartup(startup: string | undefined): { order?: number; up?: number; down?: number } {
  if (!startup) return {};
  const result: { order?: number; up?: number; down?: number } = {};
  const parts = startup.split(",");
  for (const part of parts) {
    const segments = part.split("=");
    const key = segments[0];
    const value = segments[1];
    if (!value) continue;
    if (key === "order") result.order = parseInt(value, 10);
    else if (key === "up") result.up = parseInt(value, 10);
    else if (key === "down") result.down = parseInt(value, 10);
  }
  return result;
}

function getOsIcon(ostype: string | undefined): string {
  if (!ostype) return "🐧";
  const os = ostype.toLowerCase();
  if (os.includes("debian")) return "🌀";
  if (os.includes("ubuntu")) return "🟠";
  if (os.includes("alpine")) return "🏔️";
  if (os.includes("fedora")) return "🎩";
  if (os.includes("centos") || os.includes("rhel") || os.includes("rocky") || os.includes("alma")) return "🔴";
  if (os.includes("arch")) return "🔷";
  if (os.includes("gentoo")) return "🗿";
  if (os.includes("opensuse") || os.includes("suse")) return "🦎";
  if (os.includes("nixos")) return "❄️";
  if (os.includes("devuan")) return "🔱";
  return "🐧"; // Generic Linux
}

export function DetailView({
  type,
  item,
  onBack,
  onStart,
  onStop,
  onReboot,
  onConsole,
}: DetailViewProps) {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 80;

  const [selectedAction, setSelectedAction] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [config, setConfig] = useState<VMConfig | ContainerConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [selectedTab, setSelectedTab] = useState<Tab>("summary");
  const [actionMode, setActionMode] = useState(false);

  const isRunning = item.status === "running";

  // Available tabs - Options only for containers
  const tabs: { key: Tab; label: string }[] = type === "container"
    ? [
        { key: "summary", label: "Summary" },
        { key: "options", label: "Options" },
      ]
    : [
        { key: "summary", label: "Summary" },
      ];

  // Dynamic widths based on terminal size
  const actionsWidth = 22;
  const infoWidth = Math.max(40, terminalWidth - actionsWidth - 10); // 10 for gaps/borders
  const progressBarWidth = Math.max(8, Math.min(15, infoWidth - 50)); // Smaller bars

  // Fetch config and interfaces on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const client = getClient();
        if (type === "vm") {
          const cfg = await client.getVMConfig(item.node, item.vmid);
          setConfig(cfg);
        } else {
          const cfg = await client.getContainerConfig(item.node, item.vmid);
          setConfig(cfg);
          // Fetch live interfaces for containers (to get actual IP)
          if (isRunning) {
            try {
              const ifaces = await client.getContainerInterfaces(item.node, item.vmid);
              setInterfaces(ifaces);
            } catch {
              // Interfaces fetch failed, continue without it
            }
          }
        }
      } catch {
        // Config fetch failed, continue without it
      } finally {
        setConfigLoading(false);
      }
    };
    fetchData();
  }, [type, item.node, item.vmid, isRunning]);

  // Get live IP from interfaces (prefer eth0, then any interface with an IP)
  const liveIp = (() => {
    const eth0 = interfaces.find((i) => i.name === "eth0");
    if (eth0?.inet) return eth0.inet.split("/")[0];
    const withIp = interfaces.find((i) => i.inet && i.name !== "lo");
    if (withIp?.inet) return withIp.inet.split("/")[0];
    return null;
  })();

  // Fall back to config IP if no live IP
  const netInfo = parseNetworkInfo(config?.net0);
  const displayIp = liveIp || netInfo.ip;
  const hasConsole = type === "container" && isRunning && onConsole;

  const actions: { key: Action; label: string; enabled: boolean; destructive: boolean }[] = [
    { key: "start", label: "Start", enabled: !isRunning, destructive: false },
    { key: "stop", label: "Stop", enabled: isRunning, destructive: true },
    { key: "reboot", label: "Reboot", enabled: isRunning, destructive: true },
    { key: "console", label: "Console (SSH)", enabled: !!hasConsole, destructive: false },
  ];

  const enabledActions = actions.filter((a) => a.enabled);

  useInput(async (input, key) => {
    if (loading) return;

    // Handle confirmation
    if (pendingConfirm) {
      if (key.return || input === "y") {
        setLoading(true);
        setError(null);
        try {
          if (pendingConfirm === "stop") await onStop();
          else if (pendingConfirm === "reboot") await onReboot();
          onBack();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Action failed");
          setLoading(false);
        }
        setPendingConfirm(null);
      } else if (key.escape || input === "n" || input === "q") {
        setPendingConfirm(null);
      }
      return;
    }

    // Exit action mode or go back
    if (key.escape) {
      if (actionMode) {
        setActionMode(false);
      } else {
        onBack();
      }
      return;
    }

    if (input === "q") {
      onBack();
      return;
    }

    // Toggle action mode with 'a'
    if (input === "a") {
      setActionMode(!actionMode);
      return;
    }

    // Action mode: navigate and execute actions
    if (actionMode) {
      if (input === "j" || key.downArrow) {
        setSelectedAction((prev) => (prev + 1) % enabledActions.length);
      } else if (input === "k" || key.upArrow) {
        setSelectedAction((prev) => (prev - 1 + enabledActions.length) % enabledActions.length);
      } else if (key.return) {
        const action = enabledActions[selectedAction];
        if (!action) return;

        // Require confirmation for destructive actions
        if (action.destructive) {
          setPendingConfirm(action.key);
          return;
        }

        // Handle console action
        if (action.key === "console" && onConsole) {
          onConsole(item.vmid, item.node);
          return;
        }

        setLoading(true);
        setError(null);
        try {
          if (action.key === "start") await onStart();
          onBack();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Action failed");
          setLoading(false);
        }
      }
      return;
    }

    // Tab navigation with h/l or left/right arrows (only when not in action mode)
    if (input === "h" || key.leftArrow) {
      const currentIndex = tabs.findIndex((t) => t.key === selectedTab);
      const newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      const newTab = tabs[newIndex];
      if (newTab) setSelectedTab(newTab.key);
      return;
    } else if (input === "l" || key.rightArrow) {
      const currentIndex = tabs.findIndex((t) => t.key === selectedTab);
      const newIndex = (currentIndex + 1) % tabs.length;
      const newTab = tabs[newIndex];
      if (newTab) setSelectedTab(newTab.key);
      return;
    }
  });

  const cpuPercent = item.cpus > 0 ? (item.cpu * 100) : 0;
  const memPercent = item.maxmem > 0 ? (item.mem / item.maxmem) * 100 : 0;
  const swapPercent = item.maxswap && item.maxswap > 0 ? ((item.swap || 0) / item.maxswap) * 100 : 0;
  const diskPercent = item.maxdisk > 0 ? (item.disk / item.maxdisk) * 100 : 0;

  const label = type === "vm" ? "Virtual Machine" : "Container";

  // Render tab content based on selected tab
  const renderTabContent = () => {
    if (configLoading) {
      return (
        <Box marginBottom={1}>
          <Spinner label="Loading..." />
        </Box>
      );
    }

    switch (selectedTab) {
      case "summary":
        return (
          <>
            {/* Basic Info */}
            <Box marginBottom={1} flexDirection="column">
              <Text bold dimColor>General</Text>
              <Box>
                <Box width={16}><Text dimColor>ID:</Text></Box>
                <Text>{item.vmid}</Text>
              </Box>
              <Box>
                <Box width={16}><Text dimColor>Node:</Text></Box>
                <Text>{item.node}</Text>
              </Box>
              <Box>
                <Box width={16}><Text dimColor>Status:</Text></Box>
                <Text>{item.status}</Text>
              </Box>
              {isRunning && (
                <Box>
                  <Box width={16}><Text dimColor>Uptime:</Text></Box>
                  <Text>{formatUptime(item.uptime)}</Text>
                </Box>
              )}
              {config?.tags && (
                <Box>
                  <Box width={16}><Text dimColor>Tags:</Text></Box>
                  <Text color="cyan">{config.tags}</Text>
                </Box>
              )}
              {config?.onboot !== undefined && (
                <Box>
                  <Box width={16}><Text dimColor>Start on boot:</Text></Box>
                  <Text>{config.onboot ? "Yes" : "No"}</Text>
                </Box>
              )}
            </Box>

            {/* Network Info */}
            {(displayIp || netInfo.mac || netInfo.bridge) && (
              <Box marginBottom={1} flexDirection="column">
                <Text bold dimColor>Network</Text>
                {displayIp && (
                  <Box>
                    <Box width={16}><Text dimColor>IP Address:</Text></Box>
                    <Text>{displayIp}</Text>
                    {liveIp && <Text color="green"> (live)</Text>}
                  </Box>
                )}
                {netInfo.mac && (
                  <Box>
                    <Box width={16}><Text dimColor>MAC:</Text></Box>
                    <Text>{netInfo.mac}</Text>
                  </Box>
                )}
                {netInfo.bridge && (
                  <Box>
                    <Box width={16}><Text dimColor>Bridge:</Text></Box>
                    <Text>{netInfo.bridge}</Text>
                  </Box>
                )}
              </Box>
            )}

            {/* Resources */}
            <Box marginBottom={1} flexDirection="column">
              <Text bold dimColor>Resources</Text>
              <Box>
                <Box width={16}><Text dimColor>CPU:</Text></Box>
                <Box width={progressBarWidth + 2}><ProgressBar percent={cpuPercent} width={progressBarWidth} showPercent={false} /></Box>
                <Text> {cpuPercent.toFixed(0)}% ({item.cpus} cores)</Text>
              </Box>
              <Box>
                <Box width={16}><Text dimColor>Memory:</Text></Box>
                <Box width={progressBarWidth + 2}><ProgressBar percent={memPercent} width={progressBarWidth} showPercent={false} /></Box>
                <Text> {formatBytes(item.mem)} / {formatBytes(item.maxmem)}</Text>
              </Box>
              {item.maxswap !== undefined && item.maxswap > 0 && (
                <Box>
                  <Box width={16}><Text dimColor>Swap:</Text></Box>
                  <Box width={progressBarWidth + 2}><ProgressBar percent={swapPercent} width={progressBarWidth} showPercent={false} /></Box>
                  <Text> {formatBytes(item.swap || 0)} / {formatBytes(item.maxswap)}</Text>
                </Box>
              )}
              <Box>
                <Box width={16}><Text dimColor>Disk:</Text></Box>
                <Box width={progressBarWidth + 2}><ProgressBar percent={diskPercent} width={progressBarWidth} showPercent={false} /></Box>
                <Text> {formatBytes(item.disk)} / {formatBytes(item.maxdisk)}</Text>
              </Box>
            </Box>

            {/* Notes/Description */}
            {config?.description && (
              <Box flexDirection="column">
                <Text bold dimColor>Notes</Text>
                <Text>{config.description}</Text>
              </Box>
            )}
          </>
        );

      case "options":
        if (type !== "container" || !config) return null;
        const containerConfig = config as ContainerConfig;
        const features = parseFeatures(containerConfig.features);
        const startup = parseStartup(containerConfig.startup);

        return (
          <Box flexDirection="column">
            <Box marginBottom={1} flexDirection="column">
              <Text bold dimColor>Container Options</Text>
              <Box>
                <Box width={18}><Text dimColor>OS Type:</Text></Box>
                <Text>{getOsIcon(containerConfig.ostype)} {containerConfig.ostype || "—"}</Text>
              </Box>
              <Box>
                <Box width={18}><Text dimColor>Architecture:</Text></Box>
                <Text>{containerConfig.arch || "amd64"}</Text>
              </Box>
              <Box>
                <Box width={18}><Text dimColor>Unprivileged:</Text></Box>
                <Text color={containerConfig.unprivileged ? "green" : "yellow"}>
                  {containerConfig.unprivileged ? "Yes" : "No"}
                </Text>
              </Box>
              <Box>
                <Box width={18}><Text dimColor>Protection:</Text></Box>
                <Text color={containerConfig.protection ? "green" : undefined}>
                  {containerConfig.protection ? "Enabled" : "Disabled"}
                </Text>
              </Box>
              <Box>
                <Box width={18}><Text dimColor>Console Mode:</Text></Box>
                <Text>{containerConfig.cmode || "tty"}</Text>
              </Box>
            </Box>

            <Box marginBottom={1} flexDirection="column">
              <Text bold dimColor>Startup</Text>
              <Box>
                <Box width={18}><Text dimColor>Start on boot:</Text></Box>
                <Text>{containerConfig.onboot ? "Yes" : "No"}</Text>
              </Box>
              <Box>
                <Box width={18}><Text dimColor>Start order:</Text></Box>
                <Text>{startup.order !== undefined ? startup.order : "—"}</Text>
              </Box>
              <Box>
                <Box width={18}><Text dimColor>Startup delay:</Text></Box>
                <Text>{startup.up !== undefined ? `${startup.up}s` : "—"}</Text>
              </Box>
              <Box>
                <Box width={18}><Text dimColor>Shutdown delay:</Text></Box>
                <Text>{startup.down !== undefined ? `${startup.down}s` : "—"}</Text>
              </Box>
            </Box>

            <Box flexDirection="column">
              <Text bold dimColor>Features</Text>
              {features.length > 0 ? (
                features.map((f) => (
                  <Box key={f}>
                    <Box width={18}><Text dimColor>{f}:</Text></Box>
                    <Text color="green">Enabled</Text>
                  </Box>
                ))
              ) : (
                <Text dimColor>No special features enabled</Text>
              )}
            </Box>

            {containerConfig.lock && (
              <Box marginTop={1} flexDirection="column">
                <Text bold dimColor>Lock Status</Text>
                <Text color="red">Locked: {containerConfig.lock}</Text>
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="blue">{label} Details</Text>
        <Text dimColor>
          {actionMode
            ? " (Esc to exit actions, j/k to navigate, Enter to select)"
            : tabs.length > 1
              ? " (q to go back, h/l to switch tabs, a for actions)"
              : " (q to go back, a for actions)"
          }
        </Text>
      </Box>

      {/* Tab bar */}
      {tabs.length > 1 && (
        <Box marginBottom={1}>
          {tabs.map((tab) => (
            <Box key={tab.key} marginRight={1}>
              <Text
                bold={selectedTab === tab.key}
                color={selectedTab === tab.key ? "cyan" : undefined}
                dimColor={selectedTab !== tab.key}
              >
                {selectedTab === tab.key ? `[${tab.label}]` : ` ${tab.label} `}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Confirmation dialog */}
      {pendingConfirm && (
        <Box marginBottom={1} paddingX={1} borderStyle="round" borderColor="yellow">
          <Text color="yellow">
            {pendingConfirm === "stop" ? "Stop" : "Reboot"} {type} "{item.name || item.vmid}"?
            <Text dimColor> (y/Enter to confirm, n/Esc to cancel)</Text>
          </Text>
        </Box>
      )}

      <Box flexDirection="row" gap={2}>
        {/* Left: Info */}
        <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={2} paddingY={1} width={infoWidth}>
          <Box marginBottom={1}>
            <StatusBadge status={item.status} />
            <Text> </Text>
            {type === "container" && config && (
              <Text>{getOsIcon((config as ContainerConfig).ostype)} </Text>
            )}
            <Text bold>{item.name || `${type === "vm" ? "VM" : "CT"} ${item.vmid}`}</Text>
          </Box>

          {renderTabContent()}
        </Box>

        {/* Right: Actions */}
        <Box flexDirection="column" borderStyle="round" borderColor={actionMode ? "cyan" : "gray"} paddingX={2} paddingY={1} width={actionsWidth}>
          <Box marginBottom={1}>
            <Text bold color={actionMode ? "cyan" : undefined} dimColor={!actionMode}>
              Actions {actionMode && "▸"}
            </Text>
          </Box>

          {enabledActions.map((action, index) => (
            <Box key={action.key}>
              <Text
                inverse={actionMode && selectedAction === index}
                color={actionMode && selectedAction === index ? (action.destructive ? "red" : "cyan") : undefined}
                dimColor={!actionMode}
              >
                {actionMode && selectedAction === index ? "▸" : " "}{action.label}{" "}
              </Text>
            </Box>
          ))}

          {enabledActions.length === 0 && (
            <Text dimColor>No actions available</Text>
          )}

          {!actionMode && enabledActions.length > 0 && (
            <Box marginTop={1}>
              <Text dimColor>Press 'a' to select</Text>
            </Box>
          )}

          {error && (
            <Box marginTop={1}>
              <Text color="red">{error}</Text>
            </Box>
          )}

          {loading && (
            <Box marginTop={1}>
              <Spinner label="Processing..." />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
