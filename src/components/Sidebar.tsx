import React from "react";
import { Box, Text } from "ink";

export type View = "dashboard" | "vms" | "containers" | "storage";

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

const views: { key: View; label: string; shortcut: string }[] = [
  { key: "dashboard", label: "Dashboard", shortcut: "1" },
  { key: "vms", label: "VMs", shortcut: "2" },
  { key: "containers", label: "Containers", shortcut: "3" },
  { key: "storage", label: "Storage", shortcut: "4" },
];

export function Sidebar({ currentView }: SidebarProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      width={20}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">
          proxmux
        </Text>
      </Box>

      {views.map((view) => {
        const isActive = currentView === view.key;
        return (
          <Box key={view.key}>
            <Text
              color={isActive ? "cyan" : undefined}
              bold={isActive}
              inverse={isActive}
            >
              {" "}
              <Text dimColor>{view.shortcut}</Text> {view.label}{" "}
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
