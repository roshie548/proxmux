import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useContainers } from "../hooks/useProxmox.ts";
import { useKeyboardNavigation } from "../hooks/useKeyboard.ts";
import { Spinner } from "../components/common/Spinner.tsx";
import { StatusBadge } from "../components/common/StatusBadge.tsx";
import { formatBytes, formatUptime, truncate } from "../utils/format.ts";

export function Containers() {
  const { containers, loading, error, refresh, startContainer, stopContainer, rebootContainer } =
    useContainers();
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const { selectedIndex } = useKeyboardNavigation({
    itemCount: containers.length,
    enabled: !actionLoading,
  });

  useInput(
    async (input) => {
      if (actionLoading) return;

      const container = containers[selectedIndex];
      if (!container) return;

      if (input === "r") {
        refresh();
        return;
      }

      if (input === "s" && container.status !== "running") {
        setActionLoading(container.vmid);
        try {
          await startContainer(container.node, container.vmid);
        } finally {
          setActionLoading(null);
        }
      } else if (input === "x" && container.status === "running") {
        setActionLoading(container.vmid);
        try {
          await stopContainer(container.node, container.vmid);
        } finally {
          setActionLoading(null);
        }
      } else if (input === "R" && container.status === "running") {
        setActionLoading(container.vmid);
        try {
          await rebootContainer(container.node, container.vmid);
        } finally {
          setActionLoading(null);
        }
      }
    },
    { isActive: true }
  );

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
      </Box>

      {/* Header */}
      <Box>
        <Box width={4}>
          <Text bold dimColor>ST</Text>
        </Box>
        <Box width={8}>
          <Text bold dimColor>CTID</Text>
        </Box>
        <Box width={20}>
          <Text bold dimColor>NAME</Text>
        </Box>
        <Box width={12}>
          <Text bold dimColor>NODE</Text>
        </Box>
        <Box width={8}>
          <Text bold dimColor>CPU</Text>
        </Box>
        <Box width={12}>
          <Text bold dimColor>MEM</Text>
        </Box>
        <Box width={10}>
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
            <Text inverse={isSelected}>
              <Text>{isLoading ? "◌ " : ""}</Text>
              {!isLoading && <StatusBadge status={container.status} showLabel={false} />}
              <Text> </Text>
            </Text>
            <Text inverse={isSelected}>{String(container.vmid).padEnd(7)}</Text>
            <Text inverse={isSelected}>{truncate(container.name || `CT ${container.vmid}`, 18).padEnd(19)}</Text>
            <Text inverse={isSelected} dimColor={!isSelected}>{container.node.padEnd(11)}</Text>
            <Text inverse={isSelected}>{`${cpuPercent}%`.padEnd(7)}</Text>
            <Text inverse={isSelected}>{formatBytes(container.mem).padEnd(11)}</Text>
            <Text inverse={isSelected} dimColor={!isSelected}>
              {container.status === "running" ? formatUptime(container.uptime) : "-"}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
