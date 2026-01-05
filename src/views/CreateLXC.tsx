import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { Wizard, type WizardStep, type WizardStepProps } from "../components/wizard/index.ts";
import { TextInput, Select, NumberInput, Checkbox, type SelectOption } from "../components/forms/index.ts";
import { Spinner } from "../components/common/Spinner.tsx";
import { getClient } from "../api/client.ts";
import type { Node, Storage, StorageContent, AvailableTemplate, LXCCreateConfig } from "../api/types.ts";

interface CreateLXCProps {
  onComplete: () => void;
  onCancel: () => void;
}

// Helper to format template name for display
function formatTemplateName(volid: string): string {
  // Extract filename from volid (e.g., "local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst")
  const parts = volid.split("/");
  const filename = parts[parts.length - 1] || volid;
  return filename
    .replace(".tar.zst", "")
    .replace(".tar.gz", "")
    .replace(".tar.xz", "")
    .replace("_amd64", "")
    .replace("_arm64", "");
}

// Step 1: Basic Configuration
function BasicStep({ isActive, onFieldChange, data, setFieldFocus, focusedField }: WizardStepProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextVMID, setNextVMID] = useState<number | null>(null);
  const [selectOpen, setSelectOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [nodesData, vmidData] = await Promise.all([
          getClient().getNodes(),
          getClient().getNextVMID(),
        ]);
        setNodes(nodesData);
        setNextVMID(vmidData);
        if (!data.node && nodesData.length > 0 && nodesData[0]) {
          onFieldChange("node", nodesData[0].node);
        }
        if (!data.vmid && vmidData) {
          onFieldChange("vmid", vmidData);
        }
      } catch (err) {
        console.error("Failed to load nodes:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useInput((input, key) => {
    if (!isActive) return;
    // Navigate fields with Tab
    if (key.tab && !key.shift) {
      setFieldFocus((focusedField + 1) % 3);
    } else if (key.tab && key.shift) {
      setFieldFocus((focusedField - 1 + 3) % 3);
    } else if (focusedField === 0 && !selectOpen) {
      // j/k navigation only on Select field when dropdown is closed
      if (key.downArrow || input === "j") {
        setFieldFocus((focusedField + 1) % 3);
      } else if (key.upArrow || input === "k") {
        setFieldFocus((focusedField - 1 + 3) % 3);
      }
    }
  }, { isActive });

  if (loading) {
    return <Spinner label="Loading nodes..." />;
  }

  const nodeOptions: SelectOption<string>[] = nodes.map((n) => ({
    label: n.node,
    value: n.node,
    description: n.status === "online" ? "Online" : "Offline",
  }));

  return (
    <Box flexDirection="column" gap={1}>
      <Select
        label="Node"
        options={nodeOptions}
        value={(data.node as string) || null}
        onChange={(v) => onFieldChange("node", v)}
        isActive={isActive && focusedField === 0}
        placeholder="Select a node..."
        onOpenChange={setSelectOpen}
      />
      {nodes.length > 0 && (
        <Text dimColor>({nodes.length} nodes available)</Text>
      )}
      <NumberInput
        label="CT ID"
        value={(data.vmid as number) || null}
        onChange={(v) => onFieldChange("vmid", v)}
        min={100}
        max={999999999}
        isActive={isActive && focusedField === 1}
        placeholder={nextVMID?.toString() || "100"}
      />
      <TextInput
        label="Hostname"
        value={(data.hostname as string) || ""}
        onChange={(v) => onFieldChange("hostname", v)}
        isActive={isActive && focusedField === 2}
        placeholder="my-container"
        required
      />
      <Text dimColor>Tab to move between fields</Text>
    </Box>
  );
}

// Step 2: Template Selection
function TemplateStep({ isActive, onFieldChange, data, setFieldFocus, focusedField }: WizardStepProps) {
  const [templates, setTemplates] = useState<StorageContent[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<AvailableTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDownload, setShowDownload] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [templateStorages, setTemplateStorages] = useState<Storage[]>([]);
  const [selectOpen, setSelectOpen] = useState(false);

  const node = data.node as string;

  useEffect(() => {
    async function loadTemplates() {
      if (!node) return;
      setLoading(true);
      try {
        const [localTemplates, remoteTemplates, storages] = await Promise.all([
          getClient().getAllTemplates(node),
          getClient().getAvailableTemplates(node).catch(() => []),
          getClient().getTemplateStorages(node),
        ]);
        setTemplates(localTemplates);
        setAvailableTemplates(remoteTemplates);
        setTemplateStorages(storages);
        if (!data.templateStorage && storages.length > 0 && storages[0]) {
          onFieldChange("templateStorage", storages[0].storage);
        }
      } catch (err) {
        console.error("Failed to load templates:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTemplates();
  }, [node]);

  useInput((input, key) => {
    if (!isActive) return;
    if (input === "d" && !showDownload) {
      setShowDownload(true);
      setFieldFocus(0);
    } else if (key.escape && showDownload) {
      setShowDownload(false);
      setFieldFocus(0);
    } else if (!selectOpen && showDownload) {
      // Navigate between fields when dropdown is closed
      if (key.tab && !key.shift) {
        setFieldFocus((focusedField + 1) % 2);
      } else if (key.downArrow || input === "j") {
        setFieldFocus((focusedField + 1) % 2);
      } else if (key.upArrow || input === "k") {
        setFieldFocus((focusedField - 1 + 2) % 2);
      }
    }
  }, { isActive });

  const handleDownload = useCallback(async (template: string) => {
    const storage = data.templateStorage as string;
    if (!storage || !node) return;

    setDownloading(true);
    setDownloadError(null);
    try {
      await getClient().downloadTemplate(node, storage, template);
      // Refresh templates after download starts
      setTimeout(async () => {
        const localTemplates = await getClient().getAllTemplates(node);
        setTemplates(localTemplates);
        setDownloading(false);
        setShowDownload(false);
      }, 2000);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
      setDownloading(false);
    }
  }, [node, data.templateStorage]);

  // Memoize options to prevent recreation on each render
  // Must be before any conditional returns (Rules of Hooks)
  const downloadOptions = React.useMemo(() =>
    availableTemplates
      .filter((t) => t.type === "lxc")
      .slice(0, 100) // Show more templates
      .map((t) => ({
        label: `${t.os} - ${t.package}`,
        value: t.template,
        description: t.headline,
      })),
    [availableTemplates]
  );

  const storageOptions = React.useMemo(() =>
    templateStorages.map((s) => ({
      label: s.storage,
      value: s.storage,
    })),
    [templateStorages]
  );

  if (loading) {
    return <Spinner label="Loading templates..." />;
  }

  if (showDownload) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold color="yellow">Download Template from Proxmox Repository</Text>
        {downloadError && <Text color="red">Error: {downloadError}</Text>}
        {downloading ? (
          <Spinner label="Starting download..." />
        ) : (
          <>
            <Select
              label="Storage"
              options={storageOptions}
              value={(data.templateStorage as string) || null}
              onChange={(v) => onFieldChange("templateStorage", v)}
              isActive={isActive && focusedField === 0}
              onOpenChange={setSelectOpen}
            />
            <Select
              label="Template"
              options={downloadOptions}
              value={(data.downloadTemplate as string) || null}
              onChange={(v) => {
                onFieldChange("downloadTemplate", v);
                handleDownload(v);
              }}
              isActive={isActive && focusedField === 1}
              placeholder="Select a template to download..."
              onOpenChange={setSelectOpen}
            />
            <Text dimColor>Tab to navigate, Enter to select, [Esc] Cancel</Text>
          </>
        )}
      </Box>
    );
  }

  const templateOptions: SelectOption<string>[] = templates.map((t) => ({
    label: formatTemplateName(t.volid),
    value: t.volid,
  }));

  return (
    <Box flexDirection="column" gap={1}>
      {templates.length === 0 ? (
        <Box flexDirection="column">
          <Text color="yellow">No local templates found.</Text>
          <Text dimColor>Press 'd' to download a template from the Proxmox repository.</Text>
        </Box>
      ) : (
        <>
          <Select
            label="Template"
            options={templateOptions}
            value={(data.ostemplate as string) || null}
            onChange={(v) => onFieldChange("ostemplate", v)}
            isActive={isActive && focusedField === 0}
            placeholder="Select a template..."
          />
          <Text dimColor>[d] Download new template</Text>
        </>
      )}
    </Box>
  );
}

// Step 3: Authentication
function AuthStep({ isActive, onFieldChange, data, setFieldFocus, focusedField }: WizardStepProps) {
  useInput((input, key) => {
    if (!isActive) return;
    if (key.tab && !key.shift) {
      setFieldFocus((focusedField + 1) % 2);
    } else if (key.tab && key.shift) {
      setFieldFocus((focusedField - 1 + 2) % 2);
    }
  }, { isActive });

  return (
    <Box flexDirection="column" gap={1}>
      <TextInput
        label="Root Password"
        value={(data.password as string) || ""}
        onChange={(v) => onFieldChange("password", v)}
        isActive={isActive && focusedField === 0}
        password
        placeholder="Enter root password"
        required
      />
      <TextInput
        label="SSH Public Key"
        value={(data.sshKey as string) || ""}
        onChange={(v) => onFieldChange("sshKey", v)}
        isActive={isActive && focusedField === 1}
        placeholder="ssh-rsa AAAA... (optional)"
        width={60}
      />
      <Text dimColor>Tab to move between fields</Text>
    </Box>
  );
}

// Step 4: Resources
function ResourcesStep({ isActive, onFieldChange, data, setFieldFocus, focusedField }: WizardStepProps) {
  // Set defaults
  useEffect(() => {
    if (data.cores === undefined) onFieldChange("cores", 1);
    if (data.memory === undefined) onFieldChange("memory", 512);
    if (data.swap === undefined) onFieldChange("swap", 512);
  }, []);

  useInput((input, key) => {
    if (!isActive) return;
    if (key.tab && !key.shift) {
      setFieldFocus((focusedField + 1) % 3);
    } else if (key.tab && key.shift) {
      setFieldFocus((focusedField - 1 + 3) % 3);
    }
  }, { isActive });

  return (
    <Box flexDirection="column" gap={1}>
      <NumberInput
        label="CPU Cores"
        value={(data.cores as number) ?? 1}
        onChange={(v) => onFieldChange("cores", v)}
        min={1}
        max={128}
        isActive={isActive && focusedField === 0}
      />
      <NumberInput
        label="Memory"
        value={(data.memory as number) ?? 512}
        onChange={(v) => onFieldChange("memory", v)}
        min={16}
        max={131072}
        unit="MB"
        step={128}
        isActive={isActive && focusedField === 1}
      />
      <NumberInput
        label="Swap"
        value={(data.swap as number) ?? 512}
        onChange={(v) => onFieldChange("swap", v)}
        min={0}
        max={131072}
        unit="MB"
        step={128}
        isActive={isActive && focusedField === 2}
      />
      <Text dimColor>Tab to move between fields. Use arrow keys to adjust values.</Text>
    </Box>
  );
}

// Step 5: Storage
function StorageStep({ isActive, onFieldChange, data, setFieldFocus, focusedField }: WizardStepProps) {
  const [storages, setStorages] = useState<Storage[]>([]);
  const [loading, setLoading] = useState(true);
  const node = data.node as string;

  useEffect(() => {
    async function loadStorages() {
      if (!node) return;
      try {
        const rootfsStorages = await getClient().getRootfsStorages(node);
        setStorages(rootfsStorages);
        if (!data.rootfsStorage && rootfsStorages.length > 0 && rootfsStorages[0]) {
          onFieldChange("rootfsStorage", rootfsStorages[0].storage);
        }
        if (data.rootfsSize === undefined) {
          onFieldChange("rootfsSize", 8);
        }
      } catch (err) {
        console.error("Failed to load storages:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStorages();
  }, [node]);

  useInput((input, key) => {
    if (!isActive) return;
    if (key.tab && !key.shift) {
      setFieldFocus((focusedField + 1) % 2);
    } else if (key.tab && key.shift) {
      setFieldFocus((focusedField - 1 + 2) % 2);
    }
  }, { isActive });

  if (loading) {
    return <Spinner label="Loading storage options..." />;
  }

  const storageOptions: SelectOption<string>[] = storages.map((s) => ({
    label: s.storage,
    value: s.storage,
    description: `${s.type} - ${Math.round(s.avail / 1024 / 1024 / 1024)}GB free`,
  }));

  return (
    <Box flexDirection="column" gap={1}>
      <Select
        label="Root Disk Storage"
        options={storageOptions}
        value={(data.rootfsStorage as string) || null}
        onChange={(v) => onFieldChange("rootfsStorage", v)}
        isActive={isActive && focusedField === 0}
        placeholder="Select storage..."
      />
      <NumberInput
        label="Root Disk Size"
        value={(data.rootfsSize as number) ?? 8}
        onChange={(v) => onFieldChange("rootfsSize", v)}
        min={1}
        max={10240}
        unit="GB"
        step={1}
        isActive={isActive && focusedField === 1}
      />
      <Text dimColor>Tab to move between fields</Text>
    </Box>
  );
}

// Step 6: Network
function NetworkStep({ isActive, onFieldChange, data, setFieldFocus, focusedField }: WizardStepProps) {
  const [bridges, setBridges] = useState<{ iface: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const node = data.node as string;

  useEffect(() => {
    async function loadBridges() {
      if (!node) return;
      try {
        const networkBridges = await getClient().getNetworkBridges(node);
        setBridges(networkBridges);
        if (!data.bridge && networkBridges.length > 0 && networkBridges[0]) {
          onFieldChange("bridge", networkBridges[0].iface);
        }
        if (data.ipType === undefined) {
          onFieldChange("ipType", "dhcp");
        }
      } catch (err) {
        console.error("Failed to load bridges:", err);
      } finally {
        setLoading(false);
      }
    }
    loadBridges();
  }, [node]);

  const ipType = data.ipType as string;
  const fieldCount = ipType === "static" ? 6 : 4;

  useInput((input, key) => {
    if (!isActive) return;
    if (key.tab && !key.shift) {
      setFieldFocus((focusedField + 1) % fieldCount);
    } else if (key.tab && key.shift) {
      setFieldFocus((focusedField - 1 + fieldCount) % fieldCount);
    }
  }, { isActive });

  if (loading) {
    return <Spinner label="Loading network options..." />;
  }

  const bridgeOptions: SelectOption<string>[] = bridges.map((b) => ({
    label: b.iface,
    value: b.iface,
  }));

  const ipTypeOptions: SelectOption<string>[] = [
    { label: "DHCP", value: "dhcp" },
    { label: "Static IP", value: "static" },
  ];

  let currentField = 0;

  return (
    <Box flexDirection="column" gap={1}>
      <Select
        label="Bridge"
        options={bridgeOptions}
        value={(data.bridge as string) || null}
        onChange={(v) => onFieldChange("bridge", v)}
        isActive={isActive && focusedField === currentField++}
        placeholder="Select bridge..."
      />
      <Select
        label="IP Configuration"
        options={ipTypeOptions}
        value={(data.ipType as string) || "dhcp"}
        onChange={(v) => onFieldChange("ipType", v)}
        isActive={isActive && focusedField === currentField++}
      />
      {ipType === "static" && (
        <>
          <TextInput
            label="IP Address"
            value={(data.ip as string) || ""}
            onChange={(v) => onFieldChange("ip", v)}
            isActive={isActive && focusedField === currentField++}
            placeholder="192.168.1.100/24"
            required
          />
          <TextInput
            label="Gateway"
            value={(data.gateway as string) || ""}
            onChange={(v) => onFieldChange("gateway", v)}
            isActive={isActive && focusedField === currentField++}
            placeholder="192.168.1.1"
            required
          />
        </>
      )}
      <TextInput
        label="DNS Server"
        value={(data.nameserver as string) || ""}
        onChange={(v) => onFieldChange("nameserver", v)}
        isActive={isActive && focusedField === currentField++}
        placeholder="8.8.8.8 (optional)"
      />
      <TextInput
        label="Search Domain"
        value={(data.searchdomain as string) || ""}
        onChange={(v) => onFieldChange("searchdomain", v)}
        isActive={isActive && focusedField === currentField++}
        placeholder="local (optional)"
      />
      <Text dimColor>Tab to move between fields</Text>
    </Box>
  );
}

// Step 7: Options
function OptionsStep({ isActive, onFieldChange, data, setFieldFocus, focusedField }: WizardStepProps) {
  // Set defaults
  useEffect(() => {
    if (data.unprivileged === undefined) onFieldChange("unprivileged", true);
    if (data.start === undefined) onFieldChange("start", false);
    if (data.nesting === undefined) onFieldChange("nesting", false);
    if (data.onboot === undefined) onFieldChange("onboot", false);
  }, []);

  useInput((input, key) => {
    if (!isActive) return;
    if (key.tab && !key.shift) {
      setFieldFocus((focusedField + 1) % 4);
    } else if (key.tab && key.shift) {
      setFieldFocus((focusedField - 1 + 4) % 4);
    }
  }, { isActive });

  return (
    <Box flexDirection="column" gap={1}>
      <Checkbox
        label="Unprivileged container"
        checked={(data.unprivileged as boolean) ?? true}
        onChange={(v) => onFieldChange("unprivileged", v)}
        isActive={isActive && focusedField === 0}
        description="Recommended for security"
      />
      <Checkbox
        label="Start after creation"
        checked={(data.start as boolean) ?? false}
        onChange={(v) => onFieldChange("start", v)}
        isActive={isActive && focusedField === 1}
      />
      <Checkbox
        label="Enable nesting"
        checked={(data.nesting as boolean) ?? false}
        onChange={(v) => onFieldChange("nesting", v)}
        isActive={isActive && focusedField === 2}
        description="Required for Docker inside container"
      />
      <Checkbox
        label="Start on boot"
        checked={(data.onboot as boolean) ?? false}
        onChange={(v) => onFieldChange("onboot", v)}
        isActive={isActive && focusedField === 3}
      />
      <Text dimColor>Tab to move between fields. Space/Enter to toggle.</Text>
    </Box>
  );
}

export function CreateLXC({ onComplete, onCancel }: CreateLXCProps) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps: WizardStep[] = [
    {
      id: "basic",
      title: "Basic",
      component: BasicStep,
      validate: function() {
        // Access data through closure - this is handled by Wizard
        return true;
      },
    },
    {
      id: "template",
      title: "Template",
      component: TemplateStep,
    },
    {
      id: "auth",
      title: "Authentication",
      component: AuthStep,
    },
    {
      id: "resources",
      title: "Resources",
      component: ResourcesStep,
    },
    {
      id: "storage",
      title: "Storage",
      component: StorageStep,
    },
    {
      id: "network",
      title: "Network",
      component: NetworkStep,
    },
    {
      id: "options",
      title: "Options",
      component: OptionsStep,
    },
  ];

  const handleComplete = async (data: Record<string, unknown>) => {
    setCreating(true);
    setError(null);

    try {
      const node = data.node as string;

      // Build network configuration string
      let net0 = `name=eth0,bridge=${data.bridge || "vmbr0"}`;
      if (data.ipType === "dhcp") {
        net0 += ",ip=dhcp";
      } else if (data.ipType === "static" && data.ip) {
        net0 += `,ip=${data.ip}`;
        if (data.gateway) {
          net0 += `,gw=${data.gateway}`;
        }
      }

      // Build features string
      const features: string[] = [];
      if (data.nesting) {
        features.push("nesting=1");
      }

      const config: LXCCreateConfig = {
        vmid: data.vmid as number,
        hostname: data.hostname as string,
        ostemplate: data.ostemplate as string,
        password: data.password as string,
        cores: data.cores as number,
        memory: data.memory as number,
        swap: data.swap as number,
        rootfs: `${data.rootfsStorage}:${data.rootfsSize}`,
        net0,
        unprivileged: data.unprivileged as boolean,
        start: data.start as boolean,
        onboot: data.onboot as boolean,
      };

      if (data.sshKey) {
        config["ssh-public-keys"] = data.sshKey as string;
      }
      if (data.nameserver) {
        config.nameserver = data.nameserver as string;
      }
      if (data.searchdomain) {
        config.searchdomain = data.searchdomain as string;
      }
      if (features.length > 0) {
        config.features = features.join(",");
      }

      await getClient().createContainer(node, config);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create container");
      setCreating(false);
    }
  };

  if (creating) {
    return (
      <Box flexDirection="column" padding={1}>
        <Spinner label="Creating container..." />
        {error && <Text color="red">Error: {error}</Text>}
      </Box>
    );
  }

  return (
    <Wizard
      title="Create LXC Container"
      steps={steps}
      onComplete={handleComplete}
      onCancel={onCancel}
      initialData={{
        cores: 1,
        memory: 512,
        swap: 512,
        rootfsSize: 8,
        ipType: "dhcp",
        unprivileged: true,
        start: false,
        nesting: false,
        onboot: false,
      }}
    />
  );
}
