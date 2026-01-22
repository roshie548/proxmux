import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { StatusBadge } from "./common/StatusBadge.tsx";
import { ProgressBar } from "./common/ProgressBar.tsx";
import { Spinner } from "./common/Spinner.tsx";
import { formatBytes, formatUptime } from "../utils/format.ts";
import { getClient } from "../api/client.ts";
import { useEditMode } from "../context/EditModeContext.tsx";
import type { VMConfig, ContainerConfig, NetworkInterface, ContainerConfigUpdate } from "../api/types.ts";

interface DetailViewProps {
  type: "vm" | "container";
  item: {
    vmid: number;
    name: string;
    status: "running" | "stopped" | "paused";
    node: string;
    cpu: number;
    cpus: number;
    mem: number;
    maxmem: number;
    swap?: number;
    maxswap?: number;
    disk: number;
    maxdisk: number;
    uptime: number;
  };
  onBack: () => void;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onReboot: () => Promise<void>;
  onConsole?: (vmid: number, node: string, name?: string) => void;
  onUpdate?: (config: Partial<ContainerConfigUpdate>) => Promise<void>;
}

type Action = "start" | "stop" | "reboot" | "console";
type PendingConfirm = Action | null;
type Tab = "summary" | "resources" | "network" | "options";

// Edit mode types
interface ResourcesEditValues {
  memory: string;
  swap: string;
  cores: string;
  cpulimit: string;
  cpuunits: string;
}

interface OptionsEditValues {
  hostname: string;
  onboot: boolean;
  protection: boolean;
  startupOrder: string;
  startupUp: string;
  startupDown: string;
}

function parseNetworkInfo(netConfig?: string): { ip?: string; mac?: string; bridge?: string } {
  if (!netConfig) return {};
  const parts = netConfig.split(",");
  const result: { ip?: string; mac?: string; bridge?: string } = {};

  for (const part of parts) {
    if (part.startsWith("ip=")) {
      result.ip = part.substring(3).split("/")[0];
    } else if (part.includes("=")) {
      const [key, value] = part.split("=");
      if (key === "bridge") result.bridge = value;
      if (value?.match(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/)) {
        result.mac = value;
      }
    } else if (part.match(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/)) {
      result.mac = part;
    }
  }
  return result;
}

function parseFeatures(features: string | undefined): string[] {
  if (!features) return [];
  const enabled: string[] = [];
  const parts = features.split(",");
  for (const part of parts) {
    const segments = part.split("=");
    const key = segments[0];
    const value = segments[1];
    if (key && value === "1") {
      enabled.push(key);
    }
  }
  return enabled;
}

function parseStartup(startup: string | undefined): { order?: number; up?: number; down?: number } {
  if (!startup) return {};
  const result: { order?: number; up?: number; down?: number } = {};
  const parts = startup.split(",");
  for (const part of parts) {
    const segments = part.split("=");
    const key = segments[0];
    const value = segments[1];
    if (!value) continue;
    if (key === "order") result.order = parseInt(value, 10);
    else if (key === "up") result.up = parseInt(value, 10);
    else if (key === "down") result.down = parseInt(value, 10);
  }
  return result;
}

function getOsIcon(ostype: string | undefined): string {
  if (!ostype) return "🐧";
  const os = ostype.toLowerCase();
  if (os.includes("debian")) return "🌀";
  if (os.includes("ubuntu")) return "🟠";
  if (os.includes("alpine")) return "🏔️";
  if (os.includes("fedora")) return "🎩";
  if (os.includes("centos") || os.includes("rhel") || os.includes("rocky") || os.includes("alma")) return "🔴";
  if (os.includes("arch")) return "🔷";
  if (os.includes("gentoo")) return "🗿";
  if (os.includes("opensuse") || os.includes("suse")) return "🦎";
  if (os.includes("nixos")) return "❄️";
  if (os.includes("devuan")) return "🔱";
  return "🐧";
}

export function DetailView({
  type,
  item,
  onBack,
  onStart,
  onStop,
  onReboot,
  onConsole,
  onUpdate,
}: DetailViewProps) {
  const { stdout } = useStdout();
  const { setEditing } = useEditMode();
  const terminalWidth = stdout?.columns || 80;

  const [selectedAction, setSelectedAction] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [config, setConfig] = useState<VMConfig | ContainerConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [selectedTab, setSelectedTab] = useState<Tab>("summary");
  const [actionMode, setActionMode] = useState(false);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [selectedField, setSelectedField] = useState(0);
  const [resourcesEdit, setResourcesEdit] = useState<ResourcesEditValues>({
    memory: "",
    swap: "",
    cores: "",
    cpulimit: "",
    cpuunits: "",
  });
  const [optionsEdit, setOptionsEdit] = useState<OptionsEditValues>({
    hostname: "",
    onboot: false,
    protection: false,
    startupOrder: "",
    startupUp: "",
    startupDown: "",
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditing(editMode);
    return () => setEditing(false);
  }, [editMode, setEditing]);

  const isRunning = item.status === "running";
  const isContainer = type === "container";

  const tabs: { key: Tab; label: string; editable: boolean }[] = isContainer
    ? [
        { key: "summary", label: "Summary", editable: false },
        { key: "resources", label: "Resources", editable: true },
        { key: "network", label: "Network", editable: false },
        { key: "options", label: "Options", editable: true },
      ]
    : [{ key: "summary", label: "Summary", editable: false }];

  const currentTabInfo = tabs.find((t) => t.key === selectedTab);
  const isEditable = currentTabInfo?.editable && isContainer && onUpdate;

  const isNarrow = terminalWidth < 80;
  const actionsWidth = isNarrow ? 18 : 22;
  const infoWidth = Math.max(35, terminalWidth - actionsWidth - 10);
  const progressBarWidth = Math.max(6, Math.min(12, infoWidth - 45));
  const labelWidth = isNarrow ? 12 : 16;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const client = getClient();
        if (type === "vm") {
          const cfg = await client.getVMConfig(item.node, item.vmid);
          setConfig(cfg);
        } else {
          const cfg = await client.getContainerConfig(item.node, item.vmid);
          setConfig(cfg);
          if (isRunning) {
            try {
              const ifaces = await client.getContainerInterfaces(item.node, item.vmid);
              setInterfaces(ifaces);
            } catch {
              // Interfaces fetch failed, continue without it
            }
          }
        }
      } catch {
        // Config fetch failed, continue without it
      } finally {
        setConfigLoading(false);
      }
    };
    fetchData();
  }, [type, item.node, item.vmid, isRunning]);

  useEffect(() => {
    if (config && isContainer) {
      const containerConfig = config as ContainerConfig;
      const startup = parseStartup(containerConfig.startup);

      setResourcesEdit({
        memory: String(containerConfig.memory || Math.round(item.maxmem / 1024 / 1024)),
        swap: String(containerConfig.swap || Math.round((item.maxswap || 0) / 1024 / 1024)),
        cores: String(containerConfig.cores || item.cpus),
        cpulimit: String(containerConfig.cpulimit || 0),
        cpuunits: String(containerConfig.cpuunits || 1024),
      });

      setOptionsEdit({
        hostname: containerConfig.hostname || item.name || "",
        onboot: containerConfig.onboot === 1,
        protection: containerConfig.protection === 1,
        startupOrder: startup.order !== undefined ? String(startup.order) : "",
        startupUp: startup.up !== undefined ? String(startup.up) : "",
        startupDown: startup.down !== undefined ? String(startup.down) : "",
      });
    }
  }, [config, isContainer, item]);

  const liveIp = (() => {
    const eth0 = interfaces.find((i) => i.name === "eth0");
    if (eth0?.inet) return eth0.inet.split("/")[0];
    const withIp = interfaces.find((i) => i.inet && i.name !== "lo");
    if (withIp?.inet) return withIp.inet.split("/")[0];
    return null;
  })();

  const netInfo = parseNetworkInfo(config?.net0);
  const displayIp = liveIp || netInfo.ip;
  const hasConsole = type === "container" && isRunning && onConsole;

  const actions: { key: Action; label: string; enabled: boolean; destructive: boolean }[] = [
    { key: "start", label: "Start", enabled: !isRunning, destructive: false },
    { key: "stop", label: "Stop", enabled: isRunning, destructive: true },
    { key: "reboot", label: "Reboot", enabled: isRunning, destructive: true },
    { key: "console", label: "Console", enabled: !!hasConsole, destructive: false },
  ];

  const enabledActions = actions.filter((a) => a.enabled);

  const resourceFields = ["memory", "swap", "cores", "cpulimit", "cpuunits"] as const;
  const optionFields = ["hostname", "onboot", "protection", "startupOrder", "startupUp", "startupDown"] as const;

  const handleSave = async () => {
    if (!onUpdate) return;

    setSaving(true);
    setSaveError(null);

    try {
      if (selectedTab === "resources") {
        const updates: Partial<ContainerConfigUpdate> = {};
        const mem = parseInt(resourcesEdit.memory);
        const swap = parseInt(resourcesEdit.swap);
        const cores = parseInt(resourcesEdit.cores);
        const cpulimit = parseFloat(resourcesEdit.cpulimit);
        const cpuunits = parseInt(resourcesEdit.cpuunits);

        if (!isNaN(mem) && mem > 0) updates.memory = mem;
        if (!isNaN(swap) && swap >= 0) updates.swap = swap;
        if (!isNaN(cores) && cores > 0) updates.cores = cores;
        if (!isNaN(cpulimit) && cpulimit >= 0) updates.cpulimit = cpulimit;
        if (!isNaN(cpuunits) && cpuunits >= 0) updates.cpuunits = cpuunits;

        await onUpdate(updates);
      } else if (selectedTab === "options") {
        const updates: Partial<ContainerConfigUpdate> = {};

        if (optionsEdit.hostname) updates.hostname = optionsEdit.hostname;
        updates.onboot = optionsEdit.onboot ? 1 : 0;
        updates.protection = optionsEdit.protection ? 1 : 0;

        const startupParts: string[] = [];
        if (optionsEdit.startupOrder) startupParts.push(`order=${optionsEdit.startupOrder}`);
        if (optionsEdit.startupUp) startupParts.push(`up=${optionsEdit.startupUp}`);
        if (optionsEdit.startupDown) startupParts.push(`down=${optionsEdit.startupDown}`);
        if (startupParts.length > 0) {
          updates.startup = startupParts.join(",");
        }

        await onUpdate(updates);
      }

      setEditMode(false);
      const client = getClient();
      const cfg = await client.getContainerConfig(item.node, item.vmid);
      setConfig(cfg);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  useInput(async (input, key) => {
    if (loading || saving) return;

    // Handle confirmation
    if (pendingConfirm) {
      if (key.return || input === "y") {
        setLoading(true);
        setError(null);
        try {
          if (pendingConfirm === "stop") await onStop();
          else if (pendingConfirm === "reboot") await onReboot();
          onBack();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Action failed");
          setLoading(false);
        }
        setPendingConfirm(null);
      } else if (key.escape || input === "n" || input === "q") {
        setPendingConfirm(null);
      }
      return;
    }

    // Edit mode handling
    if (editMode) {
      const fields = selectedTab === "resources" ? resourceFields : optionFields;
      const fieldCount = fields.length;

      if (key.escape) {
        setEditMode(false);
        setSaveError(null);
        setSelectedField(0);
        return;
      }

      if (key.return && !key.shift) {
        await handleSave();
        return;
      }

      if (input === "j" || key.downArrow || (key.tab && !key.shift)) {
        setSelectedField((prev) => (prev + 1) % fieldCount);
        return;
      }
      if (input === "k" || key.upArrow || (key.shift && key.tab)) {
        setSelectedField((prev) => (prev - 1 + fieldCount) % fieldCount);
        return;
      }

      const currentField = fields[selectedField];
      if (!currentField) return;

      if (selectedTab === "resources") {
        const field = currentField as keyof ResourcesEditValues;
        if (key.backspace || key.delete) {
          setResourcesEdit((prev) => ({ ...prev, [field]: prev[field].slice(0, -1) }));
        } else if (/^[0-9.]$/.test(input)) {
          setResourcesEdit((prev) => ({ ...prev, [field]: prev[field] + input }));
        }
      } else if (selectedTab === "options") {
        const field = currentField as keyof OptionsEditValues;
        if (field === "onboot" || field === "protection") {
          if (input === " ") {
            setOptionsEdit((prev) => ({ ...prev, [field]: !prev[field] }));
          }
        } else {
          if (key.backspace || key.delete) {
            setOptionsEdit((prev) => ({ ...prev, [field]: String(prev[field]).slice(0, -1) }));
          } else if (input.length === 1 && !key.ctrl && !key.meta) {
            setOptionsEdit((prev) => ({ ...prev, [field]: String(prev[field]) + input }));
          }
        }
      }
      return;
    }

    if (key.escape) {
      if (actionMode) {
        setActionMode(false);
      } else {
        onBack();
      }
      return;
    }

    if (input === "q") {
      onBack();
      return;
    }

    if (input === "e" && isEditable && !actionMode) {
      setEditMode(true);
      setSelectedField(0);
      setSaveError(null);
      return;
    }

    if (input === "a") {
      setActionMode(!actionMode);
      return;
    }

    if (actionMode) {
      if (input === "j" || key.downArrow) {
        setSelectedAction((prev) => (prev + 1) % enabledActions.length);
      } else if (input === "k" || key.upArrow) {
        setSelectedAction((prev) => (prev - 1 + enabledActions.length) % enabledActions.length);
      } else if (key.return) {
        const action = enabledActions[selectedAction];
        if (!action) return;

        if (action.destructive) {
          setPendingConfirm(action.key);
          return;
        }

        if (action.key === "console" && onConsole) {
          onConsole(item.vmid, item.node, item.name);
          return;
        }

        setLoading(true);
        setError(null);
        try {
          if (action.key === "start") await onStart();
          onBack();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Action failed");
          setLoading(false);
        }
      }
      return;
    }

    if (input === "h" || key.leftArrow) {
      const currentIndex = tabs.findIndex((t) => t.key === selectedTab);
      const newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      const newTab = tabs[newIndex];
      if (newTab) setSelectedTab(newTab.key);
      return;
    } else if (input === "l" || key.rightArrow) {
      const currentIndex = tabs.findIndex((t) => t.key === selectedTab);
      const newIndex = (currentIndex + 1) % tabs.length;
      const newTab = tabs[newIndex];
      if (newTab) setSelectedTab(newTab.key);
      return;
    }
  });

  const cpuPercent = item.cpus > 0 ? item.cpu * 100 : 0;
  const memPercent = item.maxmem > 0 ? (item.mem / item.maxmem) * 100 : 0;
  const swapPercent = item.maxswap && item.maxswap > 0 ? ((item.swap || 0) / item.maxswap) * 100 : 0;
  const diskPercent = item.maxdisk > 0 ? (item.disk / item.maxdisk) * 100 : 0;

  const label = type === "vm" ? "Virtual Machine" : "Container";

  const renderEditField = (
    fieldLabel: string,
    value: string | boolean,
    isSelected: boolean,
    isBoolean: boolean = false,
    suffix: string = ""
  ) => {
    const fieldLabelWidth = Math.min(labelWidth, 14);

    return (
      <Box>
        <Box width={fieldLabelWidth}>
          <Text dimColor>{fieldLabel}:</Text>
        </Box>
        <Box
          borderStyle={isSelected ? "single" : undefined}
          borderColor={isSelected ? "cyan" : undefined}
          paddingX={isSelected ? 1 : 0}
        >
          {isBoolean ? (
            <Text color={isSelected ? "cyan" : undefined}>
              {value ? "[x]" : "[ ]"} {value ? "Yes" : "No"}
              {isSelected && <Text dimColor> (space to toggle)</Text>}
            </Text>
          ) : (
            <Text color={isSelected ? "cyan" : undefined}>
              {value || <Text dimColor>(empty)</Text>}
              {suffix && <Text dimColor> {suffix}</Text>}
              {isSelected && <Text dimColor inverse> </Text>}
            </Text>
          )}
        </Box>
      </Box>
    );
  };

  const renderTabContent = () => {
    if (configLoading) {
      return (
        <Box marginBottom={1}>
          <Spinner label="Loading..." />
        </Box>
      );
    }

    switch (selectedTab) {
      case "summary":
        return (
          <>
            <Box marginBottom={1} flexDirection="column">
              <Text bold dimColor>
                General
              </Text>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>ID:</Text>
                </Box>
                <Text>{item.vmid}</Text>
              </Box>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Node:</Text>
                </Box>
                <Text>{item.node}</Text>
              </Box>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Status:</Text>
                </Box>
                <Text>{item.status}</Text>
              </Box>
              {isRunning && (
                <Box>
                  <Box width={labelWidth}>
                    <Text dimColor>Uptime:</Text>
                  </Box>
                  <Text>{formatUptime(item.uptime)}</Text>
                </Box>
              )}
              {config?.tags && (
                <Box>
                  <Box width={labelWidth}>
                    <Text dimColor>Tags:</Text>
                  </Box>
                  <Text color="cyan">{config.tags}</Text>
                </Box>
              )}
            </Box>

            {(displayIp || netInfo.mac || netInfo.bridge) && (
              <Box marginBottom={1} flexDirection="column">
                <Text bold dimColor>
                  Network
                </Text>
                {displayIp && (
                  <Box>
                    <Box width={labelWidth}>
                      <Text dimColor>IP Address:</Text>
                    </Box>
                    <Text>{displayIp}</Text>
                    {liveIp && <Text color="green"> (live)</Text>}
                  </Box>
                )}
                {netInfo.mac && (
                  <Box>
                    <Box width={labelWidth}>
                      <Text dimColor>MAC:</Text>
                    </Box>
                    <Text>{netInfo.mac}</Text>
                  </Box>
                )}
              </Box>
            )}

            <Box marginBottom={1} flexDirection="column">
              <Text bold dimColor>
                Resources
              </Text>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>CPU:</Text>
                </Box>
                <Box width={progressBarWidth + 2}>
                  <ProgressBar percent={cpuPercent} width={progressBarWidth} showPercent={false} />
                </Box>
                <Text>
                  {" "}
                  {cpuPercent.toFixed(0)}% ({item.cpus} cores)
                </Text>
              </Box>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Memory:</Text>
                </Box>
                <Box width={progressBarWidth + 2}>
                  <ProgressBar percent={memPercent} width={progressBarWidth} showPercent={false} />
                </Box>
                <Text>
                  {" "}
                  {formatBytes(item.mem)} / {formatBytes(item.maxmem)}
                </Text>
              </Box>
              {item.maxswap !== undefined && item.maxswap > 0 && (
                <Box>
                  <Box width={labelWidth}>
                    <Text dimColor>Swap:</Text>
                  </Box>
                  <Box width={progressBarWidth + 2}>
                    <ProgressBar percent={swapPercent} width={progressBarWidth} showPercent={false} />
                  </Box>
                  <Text>
                    {" "}
                    {formatBytes(item.swap || 0)} / {formatBytes(item.maxswap)}
                  </Text>
                </Box>
              )}
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Disk:</Text>
                </Box>
                <Box width={progressBarWidth + 2}>
                  <ProgressBar percent={diskPercent} width={progressBarWidth} showPercent={false} />
                </Box>
                <Text>
                  {" "}
                  {formatBytes(item.disk)} / {formatBytes(item.maxdisk)}
                </Text>
              </Box>
            </Box>

            {config?.description && (
              <Box flexDirection="column">
                <Text bold dimColor>
                  Notes
                </Text>
                <Text>{config.description}</Text>
              </Box>
            )}
          </>
        );

      case "resources":
        if (!isContainer || !config) return null;
        const containerConfig = config as ContainerConfig;

        if (editMode) {
          return (
            <Box flexDirection="column">
              <Box marginBottom={1}>
                <Text bold color="cyan">
                  Edit Resources
                </Text>
                <Text dimColor> (j/k navigate, Enter save, Esc cancel)</Text>
              </Box>

              {saveError && (
                <Box marginBottom={1}>
                  <Text color="red">{saveError}</Text>
                </Box>
              )}

              {saving ? (
                <Spinner label="Saving..." />
              ) : (
                <Box flexDirection="column">
                  {renderEditField("Memory", resourcesEdit.memory, selectedField === 0, false, "MB")}
                  {renderEditField("Swap", resourcesEdit.swap, selectedField === 1, false, "MB")}
                  {renderEditField("CPU Cores", resourcesEdit.cores, selectedField === 2)}
                  {renderEditField("CPU Limit", resourcesEdit.cpulimit, selectedField === 3, false, "(0=unlimited)")}
                  {renderEditField("CPU Units", resourcesEdit.cpuunits, selectedField === 4, false, "(1024 default)")}
                </Box>
              )}
            </Box>
          );
        }

        return (
          <Box flexDirection="column">
            <Box marginBottom={1} flexDirection="column">
              <Text bold dimColor>
                CPU
              </Text>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Cores:</Text>
                </Box>
                <Text>{containerConfig.cores || item.cpus}</Text>
              </Box>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Limit:</Text>
                </Box>
                <Text>{containerConfig.cpulimit || "unlimited"}</Text>
              </Box>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Units:</Text>
                </Box>
                <Text>{containerConfig.cpuunits || 1024}</Text>
              </Box>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Usage:</Text>
                </Box>
                <Box width={progressBarWidth + 2}>
                  <ProgressBar percent={cpuPercent} width={progressBarWidth} showPercent={false} />
                </Box>
                <Text> {cpuPercent.toFixed(1)}%</Text>
              </Box>
            </Box>

            <Box marginBottom={1} flexDirection="column">
              <Text bold dimColor>
                Memory
              </Text>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Allocated:</Text>
                </Box>
                <Text>{containerConfig.memory || Math.round(item.maxmem / 1024 / 1024)} MB</Text>
              </Box>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Usage:</Text>
                </Box>
                <Box width={progressBarWidth + 2}>
                  <ProgressBar percent={memPercent} width={progressBarWidth} showPercent={false} />
                </Box>
                <Text>
                  {" "}
                  {formatBytes(item.mem)} / {formatBytes(item.maxmem)}
                </Text>
              </Box>
            </Box>

            <Box flexDirection="column">
              <Text bold dimColor>
                Swap
              </Text>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Allocated:</Text>
                </Box>
                <Text>{containerConfig.swap || Math.round((item.maxswap || 0) / 1024 / 1024)} MB</Text>
              </Box>
              {item.maxswap !== undefined && item.maxswap > 0 && (
                <Box>
                  <Box width={labelWidth}>
                    <Text dimColor>Usage:</Text>
                  </Box>
                  <Box width={progressBarWidth + 2}>
                    <ProgressBar percent={swapPercent} width={progressBarWidth} showPercent={false} />
                  </Box>
                  <Text>
                    {" "}
                    {formatBytes(item.swap || 0)} / {formatBytes(item.maxswap)}
                  </Text>
                </Box>
              )}
            </Box>

            {isEditable && (
              <Box marginTop={1}>
                <Text dimColor>Press 'e' to edit</Text>
              </Box>
            )}
          </Box>
        );

      case "network":
        if (!isContainer) return null;

        // Parse all network interfaces from config
        const netInterfaces: { name: string; config: string }[] = [];
        if (config) {
          const containerCfg = config as ContainerConfig;
          if (containerCfg.net0) netInterfaces.push({ name: "net0", config: containerCfg.net0 });
          if (containerCfg.net1) netInterfaces.push({ name: "net1", config: containerCfg.net1 });
          if (containerCfg.net2) netInterfaces.push({ name: "net2", config: containerCfg.net2 });
          if (containerCfg.net3) netInterfaces.push({ name: "net3", config: containerCfg.net3 });
        }

        return (
          <Box flexDirection="column">
            {netInterfaces.length === 0 ? (
              <Text dimColor>No network interfaces configured</Text>
            ) : (
              netInterfaces.map((iface) => {
                const info = parseNetworkInfo(iface.config);
                const liveData = interfaces.find(
                  (i) => i.name === "eth" + iface.name.slice(-1) || i.name === iface.name
                );

                return (
                  <Box key={iface.name} marginBottom={1} flexDirection="column">
                    <Text bold dimColor>
                      {iface.name.toUpperCase()}
                    </Text>
                    {(liveData?.inet || info.ip) && (
                      <Box>
                        <Box width={labelWidth}>
                          <Text dimColor>IP Address:</Text>
                        </Box>
                        <Text>{liveData?.inet?.split("/")[0] || info.ip}</Text>
                        {liveData?.inet && <Text color="green"> (live)</Text>}
                      </Box>
                    )}
                    {info.mac && (
                      <Box>
                        <Box width={labelWidth}>
                          <Text dimColor>MAC:</Text>
                        </Box>
                        <Text>{info.mac}</Text>
                      </Box>
                    )}
                    {info.bridge && (
                      <Box>
                        <Box width={labelWidth}>
                          <Text dimColor>Bridge:</Text>
                        </Box>
                        <Text>{info.bridge}</Text>
                      </Box>
                    )}
                  </Box>
                );
              })
            )}

            {interfaces.length > 0 && (
              <Box marginTop={1} flexDirection="column">
                <Text bold dimColor>
                  Live Interfaces
                </Text>
                {interfaces
                  .filter((i) => i.name !== "lo")
                  .map((iface) => (
                    <Box key={iface.name}>
                      <Box width={labelWidth}>
                        <Text dimColor>{iface.name}:</Text>
                      </Box>
                      <Text>{iface.inet?.split("/")[0] || "—"}</Text>
                    </Box>
                  ))}
              </Box>
            )}
          </Box>
        );

      case "options":
        if (!isContainer || !config) return null;
        const optConfig = config as ContainerConfig;
        const features = parseFeatures(optConfig.features);
        const startup = parseStartup(optConfig.startup);

        if (editMode) {
          return (
            <Box flexDirection="column">
              <Box marginBottom={1}>
                <Text bold color="cyan">
                  Edit Options
                </Text>
                <Text dimColor> (j/k navigate, Enter save, Esc cancel)</Text>
              </Box>

              {saveError && (
                <Box marginBottom={1}>
                  <Text color="red">{saveError}</Text>
                </Box>
              )}

              {saving ? (
                <Spinner label="Saving..." />
              ) : (
                <Box flexDirection="column">
                  {renderEditField("Hostname", optionsEdit.hostname, selectedField === 0)}
                  {renderEditField("Start on boot", optionsEdit.onboot, selectedField === 1, true)}
                  {renderEditField("Protection", optionsEdit.protection, selectedField === 2, true)}
                  {renderEditField("Start order", optionsEdit.startupOrder, selectedField === 3)}
                  {renderEditField("Start delay", optionsEdit.startupUp, selectedField === 4, false, "seconds")}
                  {renderEditField("Stop delay", optionsEdit.startupDown, selectedField === 5, false, "seconds")}
                </Box>
              )}
            </Box>
          );
        }

        return (
          <Box flexDirection="column">
            <Box marginBottom={1} flexDirection="column">
              <Text bold dimColor>
                General
              </Text>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Hostname:</Text>
                </Box>
                <Text>{optConfig.hostname || item.name || "—"}</Text>
              </Box>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>OS Type:</Text>
                </Box>
                <Text>
                  {getOsIcon(optConfig.ostype)} {optConfig.ostype || "—"}
                </Text>
              </Box>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Architecture:</Text>
                </Box>
                <Text>{optConfig.arch || "amd64"}</Text>
              </Box>
            </Box>

            <Box marginBottom={1} flexDirection="column">
              <Text bold dimColor>
                Security
              </Text>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Unprivileged:</Text>
                </Box>
                <Text color={optConfig.unprivileged ? "green" : "yellow"}>
                  {optConfig.unprivileged ? "Yes" : "No"}
                </Text>
              </Box>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Protection:</Text>
                </Box>
                <Text color={optConfig.protection ? "green" : undefined}>
                  {optConfig.protection ? "Enabled" : "Disabled"}
                </Text>
              </Box>
            </Box>

            <Box marginBottom={1} flexDirection="column">
              <Text bold dimColor>
                Startup
              </Text>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Start on boot:</Text>
                </Box>
                <Text>{optConfig.onboot ? "Yes" : "No"}</Text>
              </Box>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Start order:</Text>
                </Box>
                <Text>{startup.order !== undefined ? startup.order : "—"}</Text>
              </Box>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Start delay:</Text>
                </Box>
                <Text>{startup.up !== undefined ? `${startup.up}s` : "—"}</Text>
              </Box>
              <Box>
                <Box width={labelWidth}>
                  <Text dimColor>Stop delay:</Text>
                </Box>
                <Text>{startup.down !== undefined ? `${startup.down}s` : "—"}</Text>
              </Box>
            </Box>

            {features.length > 0 && (
              <Box flexDirection="column">
                <Text bold dimColor>
                  Features
                </Text>
                {features.map((f) => (
                  <Box key={f}>
                    <Box width={labelWidth}>
                      <Text dimColor>{f}:</Text>
                    </Box>
                    <Text color="green">Enabled</Text>
                  </Box>
                ))}
              </Box>
            )}

            {optConfig.lock && (
              <Box marginTop={1} flexDirection="column">
                <Text bold dimColor>
                  Lock Status
                </Text>
                <Text color="red">Locked: {optConfig.lock}</Text>
              </Box>
            )}

            {isEditable && (
              <Box marginTop={1}>
                <Text dimColor>Press 'e' to edit</Text>
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  const getHelpText = () => {
    if (editMode) {
      return " (j/k navigate, Enter save, Esc cancel)";
    }
    if (actionMode) {
      return " (Esc exit actions, j/k navigate, Enter select)";
    }
    const parts = ["q back"];
    if (tabs.length > 1) parts.push("h/l tabs");
    parts.push("a actions");
    if (isEditable) parts.push("e edit");
    return ` (${parts.join(", ")})`;
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="blue">
          {label} Details
        </Text>
        <Text dimColor>{getHelpText()}</Text>
      </Box>

      {tabs.length > 1 && (
        <Box marginBottom={1}>
          {tabs.map((tab) => (
            <Box key={tab.key} marginRight={1}>
              <Text
                bold={selectedTab === tab.key}
                color={selectedTab === tab.key ? "cyan" : undefined}
                dimColor={selectedTab !== tab.key}
              >
                {selectedTab === tab.key ? `[${tab.label}]` : ` ${tab.label} `}
              </Text>
              {tab.editable && selectedTab === tab.key && !editMode && (
                <Text dimColor> *</Text>
              )}
            </Box>
          ))}
        </Box>
      )}

      {pendingConfirm && (
        <Box marginBottom={1} paddingX={1} borderStyle="round" borderColor="yellow">
          <Text color="yellow">
            {pendingConfirm === "stop" ? "Stop" : "Reboot"} {type} "{item.name || item.vmid}"?
            <Text dimColor> (y/Enter confirm, n/Esc cancel)</Text>
          </Text>
        </Box>
      )}

      <Box flexDirection="row" gap={2}>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={editMode ? "cyan" : "gray"}
          paddingX={2}
          paddingY={1}
          width={infoWidth}
        >
          <Box marginBottom={1}>
            <StatusBadge status={item.status} />
            <Text> </Text>
            {isContainer && config && <Text>{getOsIcon((config as ContainerConfig).ostype)} </Text>}
            <Text bold>{item.name || `${type === "vm" ? "VM" : "CT"} ${item.vmid}`}</Text>
          </Box>

          {renderTabContent()}
        </Box>

        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={actionMode ? "cyan" : "gray"}
          paddingX={2}
          paddingY={1}
          width={actionsWidth}
        >
          <Box marginBottom={1}>
            <Text bold color={actionMode ? "cyan" : undefined} dimColor={!actionMode}>
              Actions {actionMode && "▸"}
            </Text>
          </Box>

          {enabledActions.map((action, index) => (
            <Box key={action.key}>
              <Text
                inverse={actionMode && selectedAction === index}
                color={actionMode && selectedAction === index ? (action.destructive ? "red" : "cyan") : undefined}
                dimColor={!actionMode}
              >
                {actionMode && selectedAction === index ? "▸" : " "}
                {action.label}{" "}
              </Text>
            </Box>
          ))}

          {enabledActions.length === 0 && <Text dimColor>No actions</Text>}

          {!actionMode && enabledActions.length > 0 && (
            <Box marginTop={1}>
              <Text dimColor>Press 'a'</Text>
            </Box>
          )}

          {error && (
            <Box marginTop={1}>
              <Text color="red">{error}</Text>
            </Box>
          )}

          {loading && (
            <Box marginTop={1}>
              <Spinner label="..." />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
