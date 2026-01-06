import React, { useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { useVMs } from "../hooks/useProxmox.ts";
import { useKeyboardNavigation } from "../hooks/useKeyboard.ts";
import { Spinner } from "../components/common/Spinner.tsx";
import { StatusBadge } from "../components/common/StatusBadge.tsx";
import { DetailView } from "../components/DetailView.tsx";
import { formatBytes, formatUptime, truncate } from "../utils/format.ts";
import type { VM } from "../api/types.ts";

type PendingAction = { type: "stop" | "reboot"; vmid: number; node: string; name: string } | null;

interface VMsProps {
  modalOpen?: boolean;
}

export function VMs({ modalOpen }: VMsProps) {
  const { stdout } = useStdout();
  const { vms: unsortedVMs, loading, error, refresh, startVM, stopVM, rebootVM } = useVMs();

  // Sort VMs by ID
  const vms = [...unsortedVMs].sort((a, b) => a.vmid - b.vmid);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [selectedVM, setSelectedVM] = useState<VM | null>(null);

  // Responsive column widths
  const terminalWidth = stdout?.columns || 80;
  const availableWidth = Math.max(40, terminalWidth - 16);
  const isVeryNarrow = availableWidth < 45;
  const isNarrow = availableWidth < 60;
  const isWide = availableWidth >= 75;
  const cols = {
    status: 2,
    vmid: 5,
    name: isVeryNarrow ? 12 : isNarrow ? 16 : isWide ? 24 : 20,
    node: isVeryNarrow ? 0 : 8,
    cpu: 4,
    mem: 9,
    uptime: isVeryNarrow ? 0 : isNarrow ? 0 : isWide ? 12 : 6,
  };

  const { selectedIndex } = useKeyboardNavigation({
    itemCount: vms.length,
    enabled: !actionLoading && !pendingAction && !selectedVM && !modalOpen,
  });

  useInput(
    async (input, key) => {
      if (actionLoading || selectedVM) return;

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
              await stopVM(node, vmid);
            } else {
              await rebootVM(node, vmid);
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

      const vm = vms[selectedIndex];
      if (!vm) return;

      if (input === "r") {
        refresh();
        return;
      }

      // Open detail view on Enter
      if (key.return) {
        setSelectedVM(vm);
        return;
      }

      if (input === "s" && vm.status !== "running") {
        setActionLoading(vm.vmid);
        setActionError(null);
        try {
          await startVM(vm.node, vm.vmid);
        } catch (err) {
          setActionError(err instanceof Error ? err.message : "Action failed");
        } finally {
          setActionLoading(null);
        }
      } else if (input === "x" && vm.status === "running") {
        setPendingAction({ type: "stop", vmid: vm.vmid, node: vm.node, name: vm.name || `VM ${vm.vmid}` });
      } else if (input === "R" && vm.status === "running") {
        setPendingAction({ type: "reboot", vmid: vm.vmid, node: vm.node, name: vm.name || `VM ${vm.vmid}` });
      }
    },
    { isActive: !selectedVM && !modalOpen }
  );

  // Show detail view if a VM is selected
  if (selectedVM) {
    return (
      <DetailView
        type="vm"
        item={selectedVM}
        onBack={() => {
          setSelectedVM(null);
          refresh();
        }}
        onStart={async () => {
          await startVM(selectedVM.node, selectedVM.vmid);
        }}
        onStop={async () => {
          await stopVM(selectedVM.node, selectedVM.vmid);
        }}
        onReboot={async () => {
          await rebootVM(selectedVM.node, selectedVM.vmid);
        }}
      />
    );
  }

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
        {actionError && <Text color="red"> Error: {actionError}</Text>}
      </Box>

      {pendingAction && (
        <Box marginBottom={1} paddingX={1} borderStyle="round" borderColor="yellow">
          <Text color="yellow">
            {pendingAction.type === "stop" ? "Stop" : "Reboot"} VM "{pendingAction.name}"?
            <Text dimColor> (y/Enter to confirm, n/Esc to cancel)</Text>
          </Text>
        </Box>
      )}

      <Box>
        <Box width={cols.status}><Text bold dimColor wrap="truncate">S</Text></Box>
        <Box width={cols.vmid}><Text bold dimColor wrap="truncate">VMID</Text></Box>
        <Box width={cols.name}><Text bold dimColor wrap="truncate">NAME</Text></Box>
        {cols.node > 0 && <Box width={cols.node}><Text bold dimColor wrap="truncate">NODE</Text></Box>}
        <Box width={cols.cpu}><Text bold dimColor wrap="truncate">CPU</Text></Box>
        <Box width={cols.mem}><Text bold dimColor wrap="truncate">MEM</Text></Box>
        {cols.uptime > 0 && <Box width={cols.uptime}><Text bold dimColor wrap="truncate">UP</Text></Box>}
      </Box>

      {vms.map((vm, index) => {
        const isSelected = index === selectedIndex;
        const isLoading = actionLoading === vm.vmid;
        const cpuPercent = vm.cpus > 0 ? (vm.cpu * 100).toFixed(0) : "0";

        return (
          <Box key={`${vm.node}-${vm.vmid}`}>
            <Box width={cols.status}>
              <Text inverse={isSelected} wrap="truncate">
                {isLoading ? "◌" : <StatusBadge status={vm.status} showLabel={false} />}
              </Text>
            </Box>
            <Box width={cols.vmid}>
              <Text inverse={isSelected} wrap="truncate">{vm.vmid}</Text>
            </Box>
            <Box width={cols.name}>
              <Text inverse={isSelected} wrap="truncate">{truncate(vm.name || `VM${vm.vmid}`, cols.name - 1)}</Text>
            </Box>
            {cols.node > 0 && (
              <Box width={cols.node}>
                <Text inverse={isSelected} dimColor={!isSelected} wrap="truncate">{truncate(vm.node, cols.node - 1)}</Text>
              </Box>
            )}
            <Box width={cols.cpu}>
              <Text inverse={isSelected} wrap="truncate">{cpuPercent}%</Text>
            </Box>
            <Box width={cols.mem}>
              <Text inverse={isSelected} wrap="truncate">{formatBytes(vm.mem)}</Text>
            </Box>
            {cols.uptime > 0 && (
              <Box width={cols.uptime}>
                <Text inverse={isSelected} dimColor={!isSelected} wrap="truncate">
                  {vm.status === "running" ? formatUptime(vm.uptime, cols.uptime < 10) : "-"}
                </Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
