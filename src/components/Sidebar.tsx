import React from "react";
import { Box, Text, useStdout } from "ink";

export type View = "dashboard" | "vms" | "containers" | "storage";

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

const views: { key: View; label: string; shortLabel: string; shortcut: string }[] = [
  { key: "dashboard", label: "Dashboard", shortLabel: "Dash", shortcut: "1" },
  { key: "vms", label: "VMs", shortLabel: "VMs", shortcut: "2" },
  { key: "containers", label: "Containers", shortLabel: "CTs", shortcut: "3" },
  { key: "storage", label: "Storage", shortLabel: "Stor", shortcut: "4" },
];

export function Sidebar({ currentView }: SidebarProps) {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 80;

  // Sidebar width: border(2) + paddingX(2) + content
  // "3 Containers" = 12 chars, so need width >= 16 for full labels
  // Use short labels below that threshold
  const useShortLabels = terminalWidth < 90;
  const sidebarWidth = useShortLabels ? 12 : 16;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      width={sidebarWidth}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {useShortLabels ? "pmux" : "proxmux"}
        </Text>
      </Box>

      {views.map((view) => {
        const isActive = currentView === view.key;
        const displayLabel = useShortLabels ? view.shortLabel : view.label;
        return (
          <Box key={view.key} width={sidebarWidth - 4}>
            <Text
              color={isActive ? "cyan" : undefined}
              bold={isActive}
              inverse={isActive}
              wrap="truncate"
            >
              <Text dimColor>{view.shortcut}</Text> {displayLabel}
            </Text>
          </Box>
        );
      })}

      <Box flexGrow={1} />

      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>
          <Text bold>?</Text> help
        </Text>
        <Text dimColor>
          <Text bold>q</Text> quit
        </Text>
      </Box>
    </Box>
  );
}
