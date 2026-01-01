import React from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { useNodes, useVMs, useContainers } from "../hooks/useProxmox.ts";
import { Spinner } from "../components/common/Spinner.tsx";
import { StatusBadge } from "../components/common/StatusBadge.tsx";
import { ProgressBar } from "../components/common/ProgressBar.tsx";
import { formatBytes, formatUptime, truncate } from "../utils/format.ts";

export function Dashboard() {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 80;
  const contentWidth = Math.max(40, terminalWidth - 16);
  const isNarrow = contentWidth < 60;
  const barWidth = isNarrow ? 8 : 12;

  const { nodes, loading: nodesLoading, error: nodesError, refresh: refreshNodes } = useNodes();
  const { vms, loading: vmsLoading, refresh: refreshVMs } = useVMs();
  const { containers, loading: containersLoading, refresh: refreshContainers } = useContainers();

  useInput((input) => {
    if (input === "r") {
      refreshNodes();
      refreshVMs();
      refreshContainers();
    }
  });

  const loading = nodesLoading || vmsLoading || containersLoading;

  if (loading && nodes.length === 0) {
    return <Spinner label="Loading dashboard..." />;
  }

  if (nodesError) {
    return <Text color="red">Error: {nodesError}</Text>;
  }

  const runningVMs = vms.filter((vm) => vm.status === "running").length;
  const runningContainers = containers.filter((c) => c.status === "running").length;
  const onlineNodes = nodes.filter((n) => n.status === "online").length;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="blue">Dashboard</Text>
        {loading && <Text dimColor> (refreshing...)</Text>}
      </Box>

      <Box marginBottom={1} gap={1} flexWrap="wrap">
        <Box borderStyle="round" borderColor="gray" paddingX={1}>
          <Text bold>VMs </Text>
          <Text color="green">{runningVMs}</Text>
          <Text dimColor>/{vms.length}</Text>
        </Box>
        <Box borderStyle="round" borderColor="gray" paddingX={1}>
          <Text bold>CTs </Text>
          <Text color="green">{runningContainers}</Text>
          <Text dimColor>/{containers.length}</Text>
        </Box>
        <Box borderStyle="round" borderColor="gray" paddingX={1}>
          <Text bold>Nodes </Text>
          <Text color="green">{onlineNodes}</Text>
          <Text dimColor>/{nodes.length}</Text>
        </Box>
      </Box>

      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Nodes</Text>
        </Box>
        {nodes.map((node) => {
          const cpuPercent = node.maxcpu > 0 ? (node.cpu / node.maxcpu) * 100 : 0;
          const memPercent = node.maxmem > 0 ? (node.mem / node.maxmem) * 100 : 0;

          return (
            <Box key={node.node} flexDirection="column" marginBottom={1}>
              <Box gap={1}>
                <StatusBadge status={node.status} showLabel={false} />
                <Text bold wrap="truncate">{truncate(node.node, 16)}</Text>
                {!isNarrow && <Text dimColor wrap="truncate">up {formatUptime(node.uptime, true)}</Text>}
              </Box>
              <Box paddingLeft={2} gap={1} flexWrap="wrap">
                <Box>
                  <Text dimColor>CPU </Text>
                  <ProgressBar percent={cpuPercent} width={barWidth} />
                </Box>
                <Box>
                  <Text dimColor>RAM </Text>
                  <ProgressBar percent={memPercent} width={barWidth} />
                  {!isNarrow && <Text dimColor wrap="truncate"> {formatBytes(node.mem)}</Text>}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
