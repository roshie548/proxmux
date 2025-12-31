import React from "react";
import { Box, Text } from "ink";
import type { View } from "./Sidebar.tsx";

interface StatusBarProps {
  view: View;
  connected: boolean;
  host: string;
}

const viewHints: Record<View, string> = {
  dashboard: "r:refresh",
  vms: "j/k:navigate  Enter:select  s:start  x:stop  R:reboot  r:refresh",
  containers: "j/k:navigate  Enter:select  s:start  x:stop  R:reboot  r:refresh",
  storage: "j/k:navigate  r:refresh",
};

export function StatusBar({ view, connected, host }: StatusBarProps) {
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      <Text dimColor>{viewHints[view]}</Text>
      <Text>
        <Text color={connected ? "green" : "red"}>
          {connected ? "●" : "○"}
        </Text>
        <Text dimColor> {host}</Text>
      </Text>
    </Box>
  );
}
