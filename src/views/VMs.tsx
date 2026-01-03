import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { useVMs } from "../hooks/useProxmox.ts";
import { useKeyboardNavigation } from "../hooks/useKeyboard.ts";
import { Spinner } from "../components/common/Spinner.tsx";
import { StatusBadge } from "../components/common/StatusBadge.tsx";
import { DetailView } from "../components/DetailView.tsx";
import { CreateVM } from "./CreateVM.tsx";
import { formatBytes, formatUptime, truncate } from "../utils/format.ts";
import type { VM } from "../api/types.ts";

type PendingAction = { type: "stop" | "reboot"; vmid: number; node: string; name: string } | null;

interface VMsProps {
  onFormActiveChange?: (active: boolean) => void;
}

export function VMs({ onFormActiveChange }: VMsProps) {
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const { vms: unsortedVMs, loading, error, refresh, startVM, stopVM, rebootVM } = useVMs();

  // Notify parent when form mode changes
  useEffect(() => {
    onFormActiveChange?.(showCreateWizard);
  }, [showCreateWizard, onFormActiveChange]);

  // Sort VMs by ID
  const vms = [...unsortedVMs].sort((a, b) => a.vmid - b.vmid);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [selectedVM, setSelectedVM] = useState<VM | null>(null);

  const { selectedIndex } = useKeyboardNavigation({
    itemCount: vms.length,
    enabled: !actionLoading && !pendingAction && !selectedVM && !showCreateWizard,
  });

  useInput(
    async (input, key) => {
      if (actionLoading || selectedVM || showCreateWizard) return;

      // Open create VM wizard
      if (input === "c") {
        setShowCreateWizard(true);
        return;
      }

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
    { isActive: !selectedVM && !showCreateWizard }
  );

  // Show create VM wizard
  if (showCreateWizard) {
    return (
      <CreateVM
        onComplete={() => {
          setShowCreateWizard(false);
          refresh();
        }}
        onCancel={() => setShowCreateWizard(false)}
      />
    );
  }

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
        <Text dimColor>No VMs found. Press [c] to create a new VM.</Text>
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
        <Text dimColor> | [c] Create</Text>
        {loading && <Text dimColor> (refreshing...)</Text>}
        {actionError && <Text color="red"> Error: {actionError}</Text>}
      </Box>

      {/* Confirmation dialog */}
      {pendingAction && (
        <Box marginBottom={1} paddingX={1} borderStyle="round" borderColor="yellow">
          <Text color="yellow">
            {pendingAction.type === "stop" ? "Stop" : "Reboot"} VM "{pendingAction.name}"?
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
          <Text bold dimColor>VMID</Text>
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

      {/* VMs */}
      {vms.map((vm, index) => {
        const isSelected = index === selectedIndex;
        const isLoading = actionLoading === vm.vmid;
        const cpuPercent = vm.cpus > 0 ? (vm.cpu * 100).toFixed(0) : "0";

        return (
          <Box key={`${vm.node}-${vm.vmid}`}>
            <Box width={4}>
              <Text inverse={isSelected}>
                {isLoading ? "◌ " : <StatusBadge status={vm.status} showLabel={false} />}
                {" "}
              </Text>
            </Box>
            <Box width={8}>
              <Text inverse={isSelected}>{vm.vmid}</Text>
            </Box>
            <Box width={30}>
              <Text inverse={isSelected}>{truncate(vm.name || `VM ${vm.vmid}`, 28)}</Text>
            </Box>
            <Box width={16}>
              <Text inverse={isSelected} dimColor={!isSelected}>{vm.node}</Text>
            </Box>
            <Box width={10}>
              <Text inverse={isSelected}>{cpuPercent}%</Text>
            </Box>
            <Box width={14}>
              <Text inverse={isSelected}>{formatBytes(vm.mem)}</Text>
            </Box>
            <Box width={14}>
              <Text inverse={isSelected} dimColor={!isSelected}>
                {vm.status === "running" ? formatUptime(vm.uptime) : "-"}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
