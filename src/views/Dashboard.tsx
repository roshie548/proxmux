import React from "react";
import { Box, Text, useInput } from "ink";
import { useNodes, useVMs, useContainers } from "../hooks/useProxmox.ts";
import { Spinner } from "../components/common/Spinner.tsx";
import { StatusBadge } from "../components/common/StatusBadge.tsx";
import { ProgressBar } from "../components/common/ProgressBar.tsx";
import { formatBytes, formatUptime } from "../utils/format.ts";

export function Dashboard() {
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

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="blue">
          Dashboard
        </Text>
        {loading && <Text dimColor> (refreshing...)</Text>}
      </Box>

      {/* Summary */}
      <Box marginBottom={1} gap={2}>
        <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column">
          <Text bold>VMs</Text>
          <Text color="green">{runningVMs}</Text>
          <Text dimColor>/ {vms.length} total</Text>
        </Box>
        <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column">
          <Text bold>Containers</Text>
          <Text color="green">{runningContainers}</Text>
          <Text dimColor>/ {containers.length} total</Text>
        </Box>
        <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column">
          <Text bold>Nodes</Text>
          <Text color="green">{nodes.filter((n) => n.status === "online").length}</Text>
          <Text dimColor>/ {nodes.length} total</Text>
        </Box>
      </Box>

      {/* Nodes */}
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
                <Text bold>{node.node}</Text>
                <Text dimColor>uptime: {formatUptime(node.uptime)}</Text>
              </Box>
              <Box paddingLeft={2} gap={2}>
                <Box>
                  <Text dimColor>CPU </Text>
                  <ProgressBar percent={cpuPercent} width={15} />
                </Box>
                <Box>
                  <Text dimColor>RAM </Text>
                  <ProgressBar percent={memPercent} width={15} />
                  <Text dimColor> {formatBytes(node.mem)}/{formatBytes(node.maxmem)}</Text>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
