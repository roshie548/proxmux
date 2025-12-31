import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useVMs } from "../hooks/useProxmox.ts";
import { useKeyboardNavigation } from "../hooks/useKeyboard.ts";
import { Spinner } from "../components/common/Spinner.tsx";
import { StatusBadge } from "../components/common/StatusBadge.tsx";
import { formatBytes, formatUptime, truncate } from "../utils/format.ts";

export function VMs() {
  const { vms, loading, error, refresh, startVM, stopVM, rebootVM } = useVMs();
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const { selectedIndex } = useKeyboardNavigation({
    itemCount: vms.length,
    enabled: !actionLoading,
  });

  useInput(
    async (input) => {
      if (actionLoading) return;

      const vm = vms[selectedIndex];
      if (!vm) return;

      if (input === "r") {
        refresh();
        return;
      }

      if (input === "s" && vm.status !== "running") {
        setActionLoading(vm.vmid);
        try {
          await startVM(vm.node, vm.vmid);
        } finally {
          setActionLoading(null);
        }
      } else if (input === "x" && vm.status === "running") {
        setActionLoading(vm.vmid);
        try {
          await stopVM(vm.node, vm.vmid);
        } finally {
          setActionLoading(null);
        }
      } else if (input === "R" && vm.status === "running") {
        setActionLoading(vm.vmid);
        try {
          await rebootVM(vm.node, vm.vmid);
        } finally {
          setActionLoading(null);
        }
      }
    },
    { isActive: true }
  );

  if (loading && vms.length === 0) {
    return <Spinner label="Loading VMs..." />;
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (vms.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold color="blue">Virtual Machines</Text>
        <Text dimColor>No VMs found</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="blue">
          Virtual Machines
        </Text>
        <Text dimColor> ({vms.length})</Text>
        {loading && <Text dimColor> (refreshing...)</Text>}
      </Box>

      {/* Header */}
      <Box>
        <Box width={4}>
          <Text bold dimColor>ST</Text>
        </Box>
        <Box width={8}>
          <Text bold dimColor>VMID</Text>
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

      {/* VMs */}
      {vms.map((vm, index) => {
        const isSelected = index === selectedIndex;
        const isLoading = actionLoading === vm.vmid;
        const cpuPercent = vm.cpus > 0 ? (vm.cpu * 100).toFixed(0) : "0";

        return (
          <Box key={`${vm.node}-${vm.vmid}`}>
            <Text inverse={isSelected}>
              <Text>{isLoading ? "◌ " : ""}</Text>
              {!isLoading && <StatusBadge status={vm.status} showLabel={false} />}
              <Text> </Text>
            </Text>
            <Text inverse={isSelected}>{String(vm.vmid).padEnd(7)}</Text>
            <Text inverse={isSelected}>{truncate(vm.name || `VM ${vm.vmid}`, 18).padEnd(19)}</Text>
            <Text inverse={isSelected} dimColor={!isSelected}>{vm.node.padEnd(11)}</Text>
            <Text inverse={isSelected}>{`${cpuPercent}%`.padEnd(7)}</Text>
            <Text inverse={isSelected}>{formatBytes(vm.mem).padEnd(11)}</Text>
            <Text inverse={isSelected} dimColor={!isSelected}>
              {vm.status === "running" ? formatUptime(vm.uptime) : "-"}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
