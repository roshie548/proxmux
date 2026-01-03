import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { Wizard, type WizardStep, type WizardStepProps } from "../components/wizard/index.ts";
import { TextInput, Select, NumberInput, Checkbox, type SelectOption } from "../components/forms/index.ts";
import { Spinner } from "../components/common/Spinner.tsx";
import { getClient } from "../api/client.ts";
import type { Node, Storage, StorageContent, VMOsType, VMNetModel, VMDiskFormat, VMCreateConfig } from "../api/types.ts";

interface CreateVMProps {
  onComplete: () => void;
  onCancel: () => void;
}

// OS Type options
const osTypeOptions: SelectOption<VMOsType>[] = [
  { label: "Linux 6.x/5.x/4.x/3.x/2.6 Kernel", value: "l26" },
  { label: "Linux 2.4 Kernel", value: "l24" },
  { label: "Windows 11", value: "win11" },
  { label: "Windows 10", value: "win10" },
  { label: "Windows Server 2022", value: "w2k22" },
  { label: "Windows Server 2019", value: "w2k19" },
  { label: "Windows Server 2016", value: "w2k16" },
  { label: "Windows Server 2012", value: "w2k12" },
  { label: "Windows 8.x", value: "win8" },
  { label: "Windows 7", value: "win7" },
  { label: "Windows Vista", value: "wvista" },
  { label: "Windows XP", value: "wxp" },
  { label: "Solaris", value: "solaris" },
  { label: "Other", value: "other" },
];

// Network model options
const netModelOptions: SelectOption<VMNetModel>[] = [
  { label: "VirtIO (paravirtualized)", value: "virtio", description: "Best performance" },
  { label: "Intel E1000", value: "e1000", description: "Wide compatibility" },
  { label: "Realtek RTL8139", value: "rtl8139", description: "Legacy support" },
  { label: "VMware vmxnet3", value: "vmxnet3", description: "VMware compatibility" },
];

// Disk format options
const diskFormatOptions: SelectOption<VMDiskFormat>[] = [
  { label: "QCOW2", value: "qcow2", description: "Recommended, supports snapshots" },
  { label: "Raw", value: "raw", description: "Best performance" },
  { label: "VMDK", value: "vmdk", description: "VMware compatibility" },
];

// Step 1: Basic configuration
function BasicStep({ isActive, onFieldChange, data, setFieldFocus, focusedField }: WizardStepProps) {
  const nodes = (data._nodes as Node[]) || [];
  const nextVmid = data._nextVmid as number | undefined;

  const nodeOptions: SelectOption<string>[] = nodes.map((n) => ({
    label: n.node,
    value: n.node,
    description: n.status === "online" ? "Online" : "Offline",
  }));

  useInput(
    (input, key) => {
      if (!isActive) return;
      if (key.tab || key.downArrow) {
        setFieldFocus((focusedField + 1) % 3);
      } else if (key.upArrow) {
        setFieldFocus((focusedField - 1 + 3) % 3);
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column" gap={1}>
      <Select
        label="Node"
        options={nodeOptions}
        value={(data.node as string) || null}
        onChange={(v) => onFieldChange("node", v)}
        isActive={isActive && focusedField === 0}
        placeholder="Select a node..."
      />
      <Box gap={1}>
        <NumberInput
          label="VM ID"
          value={(data.vmid as number) ?? nextVmid ?? null}
          onChange={(v) => onFieldChange("vmid", v)}
          min={100}
          max={999999999}
          isActive={isActive && focusedField === 1}
          placeholder={nextVmid?.toString() || ""}
        />
        {nextVmid && (
          <Text dimColor>(Next available: {nextVmid})</Text>
        )}
      </Box>
      <TextInput
        label="Name"
        value={(data.name as string) || ""}
        onChange={(v) => onFieldChange("name", v)}
        isActive={isActive && focusedField === 2}
        placeholder="my-vm"
        required
      />
    </Box>
  );
}

// Step 2: OS configuration
function OSStep({ isActive, onFieldChange, data, setFieldFocus, focusedField }: WizardStepProps) {
  const isoStorages = (data._isoStorages as Storage[]) || [];
  const isos = (data._isos as StorageContent[]) || [];
  const [loadingIsos, setLoadingIsos] = useState(false);

  const isoStorageOptions: SelectOption<string>[] = isoStorages.map((s) => ({
    label: s.storage,
    value: s.storage,
    description: `${s.type}`,
  }));

  const isoOptions: SelectOption<string>[] = isos.map((iso) => ({
    label: iso.volid.split("/").pop() || iso.volid,
    value: iso.volid,
  }));

  // Load ISOs when storage changes
  useEffect(() => {
    const node = data.node as string;
    const isoStorage = data.isoStorage as string;
    if (node && isoStorage && isActive) {
      setLoadingIsos(true);
      getClient()
        .getIsos(node, isoStorage)
        .then((result) => {
          onFieldChange("_isos", result);
        })
        .catch(() => {
          onFieldChange("_isos", []);
        })
        .finally(() => setLoadingIsos(false));
    }
  }, [data.node, data.isoStorage, isActive, onFieldChange]);

  useInput(
    (input, key) => {
      if (!isActive) return;
      if (key.tab || key.downArrow) {
        setFieldFocus((focusedField + 1) % 3);
      } else if (key.upArrow) {
        setFieldFocus((focusedField - 1 + 3) % 3);
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column" gap={1}>
      <Select
        label="ISO Storage"
        options={isoStorageOptions}
        value={(data.isoStorage as string) || null}
        onChange={(v) => {
          onFieldChange("isoStorage", v);
          onFieldChange("iso", null);
          onFieldChange("_isos", []);
        }}
        isActive={isActive && focusedField === 0}
        placeholder="Select storage..."
      />
      {loadingIsos ? (
        <Box>
          <Text dimColor>Loading ISOs...</Text>
        </Box>
      ) : (
        <Select
          label="ISO Image"
          options={isoOptions}
          value={(data.iso as string) || null}
          onChange={(v) => onFieldChange("iso", v)}
          isActive={isActive && focusedField === 1}
          placeholder={isos.length === 0 ? "No ISOs found" : "Select an ISO..."}
        />
      )}
      <Select
        label="OS Type"
        options={osTypeOptions}
        value={(data.ostype as VMOsType) || null}
        onChange={(v) => onFieldChange("ostype", v)}
        isActive={isActive && focusedField === 2}
        placeholder="Select OS type..."
      />
    </Box>
  );
}

// Step 3: CPU configuration
function CPUStep({ isActive, onFieldChange, data, setFieldFocus, focusedField }: WizardStepProps) {
  useInput(
    (input, key) => {
      if (!isActive) return;
      if (key.tab || key.downArrow) {
        setFieldFocus((focusedField + 1) % 2);
      } else if (key.upArrow) {
        setFieldFocus((focusedField - 1 + 2) % 2);
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column" gap={1}>
      <NumberInput
        label="CPU Cores"
        value={(data.cores as number) ?? 1}
        onChange={(v) => onFieldChange("cores", v)}
        min={1}
        max={128}
        step={1}
        isActive={isActive && focusedField === 0}
      />
      <NumberInput
        label="CPU Sockets"
        value={(data.sockets as number) ?? 1}
        onChange={(v) => onFieldChange("sockets", v)}
        min={1}
        max={4}
        step={1}
        isActive={isActive && focusedField === 1}
      />
      <Text dimColor>
        Total vCPUs: {((data.cores as number) || 1) * ((data.sockets as number) || 1)}
      </Text>
    </Box>
  );
}

// Step 4: Memory configuration
function MemoryStep({ isActive, onFieldChange, data, setFieldFocus, focusedField }: WizardStepProps) {
  useInput(
    (input, key) => {
      if (!isActive) return;
      // Only one field, no navigation needed
    },
    { isActive }
  );

  const memoryMB = (data.memory as number) || 2048;
  const memoryGB = (memoryMB / 1024).toFixed(1);

  return (
    <Box flexDirection="column" gap={1}>
      <NumberInput
        label="Memory"
        value={memoryMB}
        onChange={(v) => onFieldChange("memory", v)}
        min={128}
        max={1048576}
        step={512}
        unit="MB"
        isActive={isActive && focusedField === 0}
      />
      <Text dimColor>= {memoryGB} GB</Text>
    </Box>
  );
}

// Step 5: Disk configuration
function DiskStep({ isActive, onFieldChange, data, setFieldFocus, focusedField }: WizardStepProps) {
  const diskStorages = (data._diskStorages as Storage[]) || [];

  const diskStorageOptions: SelectOption<string>[] = diskStorages.map((s) => ({
    label: s.storage,
    value: s.storage,
    description: `${s.type} - ${Math.round(s.avail / 1024 / 1024 / 1024)} GB free`,
  }));

  useInput(
    (input, key) => {
      if (!isActive) return;
      if (key.tab || key.downArrow) {
        setFieldFocus((focusedField + 1) % 3);
      } else if (key.upArrow) {
        setFieldFocus((focusedField - 1 + 3) % 3);
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column" gap={1}>
      <Select
        label="Storage"
        options={diskStorageOptions}
        value={(data.diskStorage as string) || null}
        onChange={(v) => onFieldChange("diskStorage", v)}
        isActive={isActive && focusedField === 0}
        placeholder="Select storage..."
      />
      <NumberInput
        label="Disk Size"
        value={(data.diskSize as number) ?? 32}
        onChange={(v) => onFieldChange("diskSize", v)}
        min={1}
        max={10240}
        step={8}
        unit="GB"
        isActive={isActive && focusedField === 1}
      />
      <Select
        label="Format"
        options={diskFormatOptions}
        value={(data.diskFormat as VMDiskFormat) || "qcow2"}
        onChange={(v) => onFieldChange("diskFormat", v)}
        isActive={isActive && focusedField === 2}
      />
    </Box>
  );
}

// Step 6: Network configuration
function NetworkStep({ isActive, onFieldChange, data, setFieldFocus, focusedField }: WizardStepProps) {
  const bridges = (data._bridges as string[]) || [];

  const bridgeOptions: SelectOption<string>[] = bridges.map((b) => ({
    label: b,
    value: b,
  }));

  useInput(
    (input, key) => {
      if (!isActive) return;
      if (key.tab || key.downArrow) {
        setFieldFocus((focusedField + 1) % 3);
      } else if (key.upArrow) {
        setFieldFocus((focusedField - 1 + 3) % 3);
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column" gap={1}>
      <Select
        label="Bridge"
        options={bridgeOptions}
        value={(data.bridge as string) || null}
        onChange={(v) => onFieldChange("bridge", v)}
        isActive={isActive && focusedField === 0}
        placeholder="Select bridge..."
      />
      <Select
        label="Model"
        options={netModelOptions}
        value={(data.netModel as VMNetModel) || "virtio"}
        onChange={(v) => onFieldChange("netModel", v)}
        isActive={isActive && focusedField === 1}
      />
      <TextInput
        label="MAC Address"
        value={(data.macaddr as string) || ""}
        onChange={(v) => onFieldChange("macaddr", v)}
        isActive={isActive && focusedField === 2}
        placeholder="auto-generate"
      />
    </Box>
  );
}

// Step 7: Options
function OptionsStep({ isActive, onFieldChange, data, setFieldFocus, focusedField }: WizardStepProps) {
  useInput(
    (input, key) => {
      if (!isActive) return;
      if (key.tab || key.downArrow) {
        setFieldFocus((focusedField + 1) % 2);
      } else if (key.upArrow) {
        setFieldFocus((focusedField - 1 + 2) % 2);
      }
    },
    { isActive }
  );

  return (
    <Box flexDirection="column" gap={1}>
      <Checkbox
        label="Start after creation"
        checked={(data.startAfterCreate as boolean) ?? false}
        onChange={(v) => onFieldChange("startAfterCreate", v)}
        isActive={isActive && focusedField === 0}
        description="Automatically start the VM after it is created"
      />
      <Box marginTop={1}>
        <Text dimColor>Boot order: Disk, CD-ROM, Network</Text>
      </Box>

      {/* Summary */}
      <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" padding={1}>
        <Text bold>Summary:</Text>
        <Text>Node: {(data.node as string) || "-"}</Text>
        <Text>VMID: {(data.vmid as number) || "-"}</Text>
        <Text>Name: {(data.name as string) || "-"}</Text>
        <Text>OS: {osTypeOptions.find(o => o.value === data.ostype)?.label || "-"}</Text>
        <Text>CPU: {(data.cores as number) || 1} cores x {(data.sockets as number) || 1} sockets</Text>
        <Text>Memory: {(data.memory as number) || 2048} MB</Text>
        <Text>Disk: {(data.diskSize as number) || 32} GB on {(data.diskStorage as string) || "-"}</Text>
        <Text>Network: {(data.netModel as string) || "virtio"} on {(data.bridge as string) || "-"}</Text>
      </Box>
    </Box>
  );
}

export function CreateVM({ onComplete, onCancel }: CreateVMProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<Record<string, unknown>>({});

  // Load initial data (nodes, next vmid, storages)
  useEffect(() => {
    async function loadInitialData() {
      try {
        const client = getClient();
        const [nodes, nextVmid] = await Promise.all([
          client.getNodes(),
          client.getNextVmid(),
        ]);

        const onlineNodes = nodes.filter((n) => n.status === "online");
        const firstNode = onlineNodes[0]?.node || nodes[0]?.node;

        let isoStorages: Storage[] = [];
        let diskStorages: Storage[] = [];
        let bridges: string[] = [];

        if (firstNode) {
          [isoStorages, diskStorages, bridges] = await Promise.all([
            client.getStoragesForContent(firstNode, "iso"),
            client.getStoragesForContent(firstNode, "images"),
            client.getNetworkBridges(firstNode),
          ]);
        }

        setInitialData({
          _nodes: nodes,
          _nextVmid: nextVmid,
          _isoStorages: isoStorages,
          _diskStorages: diskStorages,
          _bridges: bridges,
          _isos: [],
          node: firstNode || null,
          vmid: nextVmid,
          name: "",
          ostype: "l26",
          cores: 2,
          sockets: 1,
          memory: 2048,
          diskStorage: diskStorages[0]?.storage || null,
          diskSize: 32,
          diskFormat: "qcow2",
          bridge: bridges[0] || null,
          netModel: "virtio",
          macaddr: "",
          startAfterCreate: false,
        });
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  const handleComplete = useCallback(
    async (data: Record<string, unknown>) => {
      const client = getClient();
      const node = data.node as string;

      const config: VMCreateConfig = {
        vmid: data.vmid as number,
        name: data.name as string,
        iso: data.iso as string | undefined,
        ostype: (data.ostype as VMOsType) || "l26",
        cores: (data.cores as number) || 2,
        sockets: (data.sockets as number) || 1,
        memory: (data.memory as number) || 2048,
        disk: {
          storage: data.diskStorage as string,
          size: (data.diskSize as number) || 32,
          format: (data.diskFormat as VMDiskFormat) || "qcow2",
        },
        network: {
          bridge: data.bridge as string,
          model: (data.netModel as VMNetModel) || "virtio",
          macaddr: (data.macaddr as string) || undefined,
        },
        start: data.startAfterCreate as boolean,
      };

      await client.createVM(node, config);
      onComplete();
    },
    [onComplete]
  );

  const steps: WizardStep[] = [
    {
      id: "basic",
      title: "Basic",
      component: BasicStep,
      validate: () => {
        const data = initialData;
        if (!data.node) return "Please select a node";
        if (!data.vmid) return "Please enter a VM ID";
        if (!data.name) return "Please enter a name";
        return true;
      },
    },
    {
      id: "os",
      title: "OS",
      component: OSStep,
      validate: () => {
        const data = initialData;
        if (!data.ostype) return "Please select an OS type";
        return true;
      },
    },
    {
      id: "cpu",
      title: "CPU",
      component: CPUStep,
    },
    {
      id: "memory",
      title: "Memory",
      component: MemoryStep,
    },
    {
      id: "disk",
      title: "Disk",
      component: DiskStep,
      validate: () => {
        const data = initialData;
        if (!data.diskStorage) return "Please select a storage";
        if (!data.diskSize || (data.diskSize as number) < 1) return "Please enter a valid disk size";
        return true;
      },
    },
    {
      id: "network",
      title: "Network",
      component: NetworkStep,
      validate: () => {
        const data = initialData;
        if (!data.bridge) return "Please select a network bridge";
        return true;
      },
    },
    {
      id: "options",
      title: "Options",
      component: OptionsStep,
    },
  ];

  if (loading) {
    return <Spinner label="Loading configuration..." />;
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Press Esc to go back</Text>
      </Box>
    );
  }

  return (
    <Wizard
      title="Create Virtual Machine"
      steps={steps}
      onComplete={handleComplete}
      onCancel={onCancel}
      initialData={initialData}
    />
  );
}
