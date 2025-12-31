import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { spawnSync } from "child_process";
import { useContainers } from "../hooks/useProxmox.ts";
import { useKeyboardNavigation } from "../hooks/useKeyboard.ts";
import { Spinner } from "../components/common/Spinner.tsx";
import { StatusBadge } from "../components/common/StatusBadge.tsx";
import { DetailView } from "../components/DetailView.tsx";
import { formatBytes, formatUptime, truncate } from "../utils/format.ts";
import type { Container } from "../api/types.ts";

type PendingAction = { type: "stop" | "reboot"; vmid: number; node: string; name: string } | null;

interface ContainersProps {
  host: string;
}

export function Containers({ host }: ContainersProps) {
  const { containers: unsortedContainers, loading, error, refresh, startContainer, stopContainer, rebootContainer } =
    useContainers();

  // Sort containers by ID
  const containers = [...unsortedContainers].sort((a, b) => a.vmid - b.vmid);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [consoleActive, setConsoleActive] = useState(false);

  // Extract hostname from Proxmox URL for SSH
  const proxmoxHost = (() => {
    try {
      const url = new URL(host);
      return url.hostname;
    } catch {
      return host;
    }
  })();

  // Handle console - SSH to Proxmox host and run pct enter
  const handleConsole = (vmid: number, _node: string) => {
    setConsoleActive(true);

    // Give React a moment to update, then run SSH synchronously
    setTimeout(() => {
      // Pause Ink's stdin handling and reset terminal
      process.stdin.setRawMode?.(false);
      process.stdout.write("\x1b[?25h"); // Show cursor
      console.clear();

      // Run SSH synchronously - blocks until user exits
      // Use 'pct console' to get login prompt (like Proxmox web UI)
      spawnSync("ssh", [
        "-t",
        "-o", "StrictHostKeyChecking=accept-new",
        `root@${proxmoxHost}`,
        `pct console ${vmid}`
      ], {
        stdio: "inherit",
      });

      // Restore terminal for Ink
      console.clear();
      process.stdin.setRawMode?.(true);
      process.stdin.resume();

      setConsoleActive(false);
      setSelectedContainer(null);
      refresh();
    }, 50);
  };

  const { selectedIndex } = useKeyboardNavigation({
    itemCount: containers.length,
    enabled: !actionLoading && !pendingAction && !selectedContainer && !consoleActive,
  });

  useInput(
    async (input, key) => {
      if (actionLoading || selectedContainer) return;

      // Clear previous error on any key
      if (actionError) {
        setActionError(null);
      }

      // Handle confirmation dialog
      if (pendingAction) {
        if (key.return || input === "y") {
          const { type, vmid, node } = pendingAction;
          setPendingAction(null);
          setActionLoading(vmid);
          setActionError(null);
          try {
            if (type === "stop") {
              await stopContainer(node, vmid);
            } else {
              await rebootContainer(node, vmid);
            }
          } catch (err) {
            setActionError(err instanceof Error ? err.message : "Action failed");
          } finally {
            setActionLoading(null);
          }
        } else if (key.escape || input === "n" || input === "q") {
          setPendingAction(null);
        }
        return;
      }

      const container = containers[selectedIndex];
      if (!container) return;

      if (input === "r") {
        refresh();
        return;
      }

      // Open detail view on Enter
      if (key.return) {
        setSelectedContainer(container);
        return;
      }

      if (input === "s" && container.status !== "running") {
        setActionLoading(container.vmid);
        setActionError(null);
        try {
          await startContainer(container.node, container.vmid);
        } catch (err) {
          setActionError(err instanceof Error ? err.message : "Action failed");
        } finally {
          setActionLoading(null);
        }
      } else if (input === "x" && container.status === "running") {
        setPendingAction({ type: "stop", vmid: container.vmid, node: container.node, name: container.name || `CT ${container.vmid}` });
      } else if (input === "R" && container.status === "running") {
        setPendingAction({ type: "reboot", vmid: container.vmid, node: container.node, name: container.name || `CT ${container.vmid}` });
      }
    },
    { isActive: !selectedContainer && !consoleActive }
  );

  // Show message while console is active (SSH takes over the terminal)
  if (consoleActive) {
    return (
      <Box flexDirection="column">
        <Spinner label="Console session active..." />
      </Box>
    );
  }

  // Show detail view if a container is selected
  if (selectedContainer) {
    return (
      <DetailView
        type="container"
        item={selectedContainer}
        onBack={() => {
          setSelectedContainer(null);
          refresh();
        }}
        onStart={async () => {
          await startContainer(selectedContainer.node, selectedContainer.vmid);
        }}
        onStop={async () => {
          await stopContainer(selectedContainer.node, selectedContainer.vmid);
        }}
        onReboot={async () => {
          await rebootContainer(selectedContainer.node, selectedContainer.vmid);
        }}
        onConsole={handleConsole}
      />
    );
  }

  if (loading && containers.length === 0) {
    return <Spinner label="Loading containers..." />;
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (containers.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold color="blue">Containers (LXC)</Text>
        <Text dimColor>No containers found</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="blue">
          Containers (LXC)
        </Text>
        <Text dimColor> ({containers.length})</Text>
        {loading && <Text dimColor> (refreshing...)</Text>}
        {actionError && <Text color="red"> Error: {actionError}</Text>}
      </Box>

      {/* Confirmation dialog */}
      {pendingAction && (
        <Box marginBottom={1} paddingX={1} borderStyle="round" borderColor="yellow">
          <Text color="yellow">
            {pendingAction.type === "stop" ? "Stop" : "Reboot"} container "{pendingAction.name}"?
            <Text dimColor> (y/Enter to confirm, n/Esc to cancel)</Text>
          </Text>
        </Box>
      )}

      {/* Header */}
      <Box>
        <Box width={4}>
          <Text bold dimColor>ST</Text>
        </Box>
        <Box width={8}>
          <Text bold dimColor>CTID</Text>
        </Box>
        <Box width={30}>
          <Text bold dimColor>NAME</Text>
        </Box>
        <Box width={16}>
          <Text bold dimColor>NODE</Text>
        </Box>
        <Box width={10}>
          <Text bold dimColor>CPU</Text>
        </Box>
        <Box width={14}>
          <Text bold dimColor>MEM</Text>
        </Box>
        <Box width={14}>
          <Text bold dimColor>UPTIME</Text>
        </Box>
      </Box>

      {/* Containers */}
      {containers.map((container, index) => {
        const isSelected = index === selectedIndex;
        const isLoading = actionLoading === container.vmid;
        const cpuPercent = container.cpus > 0 ? (container.cpu * 100).toFixed(0) : "0";

        return (
          <Box key={`${container.node}-${container.vmid}`}>
            <Box width={4}>
              <Text inverse={isSelected}>
                {isLoading ? "◌ " : <StatusBadge status={container.status} showLabel={false} />}
                {" "}
              </Text>
            </Box>
            <Box width={8}>
              <Text inverse={isSelected}>{container.vmid}</Text>
            </Box>
            <Box width={30}>
              <Text inverse={isSelected}>{truncate(container.name || `CT ${container.vmid}`, 28)}</Text>
            </Box>
            <Box width={16}>
              <Text inverse={isSelected} dimColor={!isSelected}>{container.node}</Text>
            </Box>
            <Box width={10}>
              <Text inverse={isSelected}>{cpuPercent}%</Text>
            </Box>
            <Box width={14}>
              <Text inverse={isSelected}>{formatBytes(container.mem)}</Text>
            </Box>
            <Box width={14}>
              <Text inverse={isSelected} dimColor={!isSelected}>
                {container.status === "running" ? formatUptime(container.uptime) : "-"}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
