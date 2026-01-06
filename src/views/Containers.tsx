import React, { useState, useMemo } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { spawnSync } from "child_process";
import { useContainers } from "../hooks/useProxmox.ts";
import { useKeyboardNavigation } from "../hooks/useKeyboard.ts";
import { Spinner } from "../components/common/Spinner.tsx";
import { StatusBadge } from "../components/common/StatusBadge.tsx";
import { DetailView } from "../components/DetailView.tsx";
import { formatBytes, formatUptime, truncate } from "../utils/format.ts";
import type { Container } from "../api/types.ts";

interface ColumnConfig {
  stWidth: number;
  idWidth: number;
  nameWidth: number;
  nodeWidth: number;
  cpuWidth: number;
  memWidth: number;
  uptimeWidth: number;
  showNode: boolean;
  showUptime: boolean;
}

type PendingAction = { type: "stop" | "reboot"; vmid: number; node: string; name: string } | null;

interface ContainersProps {
  host: string;
  modalOpen?: boolean;
  onError?: (title: string, message: string) => void;
}

function calculateColumns(availableWidth: number): ColumnConfig {
  // Fixed columns
  const stWidth = 2;
  const idWidth = 5;
  const cpuWidth = 4;
  const memWidth = 9;

  // Optional columns - uptime needs more space for full format
  const nodeWidth = 8;
  const uptimeWidthFull = 12;  // "192d 3h 46m"
  const uptimeWidthCompact = 6; // "192d"

  const fixedTotal = stWidth + idWidth + cpuWidth + memWidth;
  const remaining = availableWidth - fixedTotal;
  const minNameWidth = 10;

  // Decide which optional columns to show
  const needForAllFull = minNameWidth + nodeWidth + uptimeWidthFull;
  const needForAllCompact = minNameWidth + nodeWidth + uptimeWidthCompact;
  const needForNode = minNameWidth + nodeWidth;

  if (remaining < needForNode) {
    // Very narrow: essential columns only
    return {
      stWidth, idWidth, cpuWidth, memWidth,
      nameWidth: Math.max(minNameWidth, remaining),
      nodeWidth: 0, uptimeWidth: 0,
      showNode: false, showUptime: false,
    };
  }

  if (remaining < needForAllCompact) {
    // Narrow: hide uptime
    return {
      stWidth, idWidth, cpuWidth, memWidth,
      nameWidth: Math.max(minNameWidth, remaining - nodeWidth),
      nodeWidth, uptimeWidth: 0,
      showNode: true, showUptime: false,
    };
  }

  if (remaining < needForAllFull) {
    // Medium: compact uptime
    return {
      stWidth, idWidth, cpuWidth, memWidth,
      nameWidth: Math.max(minNameWidth, remaining - nodeWidth - uptimeWidthCompact),
      nodeWidth, uptimeWidth: uptimeWidthCompact,
      showNode: true, showUptime: true,
    };
  }

  // Wide: full uptime, give extra space to name
  const extraSpace = remaining - needForAllFull;
  return {
    stWidth, idWidth, cpuWidth, memWidth,
    nameWidth: Math.min(28, minNameWidth + extraSpace),
    nodeWidth, uptimeWidth: uptimeWidthFull,
    showNode: true, showUptime: true,
  };
}

export function Containers({ host, modalOpen, onError }: ContainersProps) {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 80;
  // Account for sidebar (~18) and padding
  const contentWidth = Math.max(40, terminalWidth - 20);
  const cols = useMemo(() => calculateColumns(contentWidth), [contentWidth]);

  const { containers: unsortedContainers, loading, error, refresh, startContainer, stopContainer, rebootContainer, updateContainer } =
    useContainers();

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

  const handleConsole = (vmid: number, _node: string) => {
    setConsoleActive(true);

    setTimeout(() => {
      process.stdin.setRawMode?.(false);
      process.stdout.write("\x1b[?25h");
      console.clear();

      let errorToShow: string | null = null;

      try {
        const sshTarget = proxmoxHost;

        const result = spawnSync("ssh", [
          "-t",
          "-o", "StrictHostKeyChecking=accept-new",
          "-o", "ConnectTimeout=10",
          `root@${sshTarget}`,
          `pct console ${vmid}`
        ], {
          stdio: "inherit",
        });

        if (result.error || (result.status !== 0 && result.status !== null)) {
          const diagResult = spawnSync("ssh", [
            "-v",
            "-o", "StrictHostKeyChecking=accept-new",
            "-o", "ConnectTimeout=5",
            "-o", "BatchMode=yes",
            `root@${sshTarget}`,
            `pct console ${vmid}`
          ], {
            stdio: ["pipe", "pipe", "pipe"],
            encoding: "utf-8",
          });

          const stderr = diagResult.stderr?.trim() || "";
          const stdout = diagResult.stdout?.trim() || "";
          const output = stderr || stdout || "No output captured";

          const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, "");

          const relevantLines = stripAnsi(output)
            .split("\n")
            .filter(line => !line.startsWith("debug1:") && line.trim())
            .slice(-10)
            .join("\n");

          const exitCode = result.status ?? diagResult.status ?? "unknown";

          errorToShow =
            `Exit code: ${exitCode}\n` +
            `\n` +
            `Error output:\n` +
            `${relevantLines}\n` +
            `\n` +
            `Command:\n` +
            `  ssh -t root@${sshTarget} "pct console ${vmid}"`;
        }
      } catch (err) {
        errorToShow = err instanceof Error ? err.message : "Console connection failed";
      }

      if (errorToShow && onError) {
        onError("Console Connection Failed", errorToShow);
      }

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
    enabled: !actionLoading && !pendingAction && !selectedContainer && !consoleActive && !modalOpen,
  });

  useInput(
    async (input, key) => {
      if (actionLoading || selectedContainer) return;

      if (actionError) {
        setActionError(null);
      }

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
    { isActive: !selectedContainer && !consoleActive && !modalOpen }
  );

  if (consoleActive) {
    return (
      <Box flexDirection="column">
        <Spinner label="Console session active..." />
      </Box>
    );
  }

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
        onUpdate={async (config) => {
          await updateContainer(selectedContainer.node, selectedContainer.vmid, config);
        }}
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

      {pendingAction && (
        <Box marginBottom={1} paddingX={1} borderStyle="round" borderColor="yellow">
          <Text color="yellow">
            {pendingAction.type === "stop" ? "Stop" : "Reboot"} container "{pendingAction.name}"?
            <Text dimColor> (y/Enter to confirm, n/Esc to cancel)</Text>
          </Text>
        </Box>
      )}

      <Box>
        <Box width={cols.stWidth}><Text bold dimColor wrap="truncate">S</Text></Box>
        <Box width={cols.idWidth}><Text bold dimColor wrap="truncate">CTID</Text></Box>
        <Box width={cols.nameWidth}><Text bold dimColor wrap="truncate">NAME</Text></Box>
        {cols.showNode && <Box width={cols.nodeWidth}><Text bold dimColor wrap="truncate">NODE</Text></Box>}
        <Box width={cols.cpuWidth}><Text bold dimColor wrap="truncate">CPU</Text></Box>
        <Box width={cols.memWidth}><Text bold dimColor wrap="truncate">MEM</Text></Box>
        {cols.showUptime && <Box width={cols.uptimeWidth}><Text bold dimColor wrap="truncate">UP</Text></Box>}
      </Box>

      {containers.map((container, index) => {
        const isSelected = index === selectedIndex;
        const isLoading = actionLoading === container.vmid;
        const cpuPercent = container.cpus > 0 ? (container.cpu * 100).toFixed(0) : "0";

        return (
          <Box key={`${container.node}-${container.vmid}`}>
            <Box width={cols.stWidth}>
              <Text inverse={isSelected} wrap="truncate">
                {isLoading ? "◌" : <StatusBadge status={container.status} showLabel={false} />}
              </Text>
            </Box>
            <Box width={cols.idWidth}>
              <Text inverse={isSelected} wrap="truncate">{container.vmid}</Text>
            </Box>
            <Box width={cols.nameWidth}>
              <Text inverse={isSelected} wrap="truncate">{truncate(container.name || `CT${container.vmid}`, cols.nameWidth - 1)}</Text>
            </Box>
            {cols.showNode && (
              <Box width={cols.nodeWidth}>
                <Text inverse={isSelected} dimColor={!isSelected} wrap="truncate">{truncate(container.node, cols.nodeWidth - 1)}</Text>
              </Box>
            )}
            <Box width={cols.cpuWidth}>
              <Text inverse={isSelected} wrap="truncate">{cpuPercent}%</Text>
            </Box>
            <Box width={cols.memWidth}>
              <Text inverse={isSelected} wrap="truncate">{formatBytes(container.mem)}</Text>
            </Box>
            {cols.showUptime && (
              <Box width={cols.uptimeWidth}>
                <Text inverse={isSelected} dimColor={!isSelected} wrap="truncate">
                  {container.status === "running" ? formatUptime(container.uptime, cols.uptimeWidth < 10) : "-"}
                </Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
