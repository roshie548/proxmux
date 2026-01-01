import React from "react";
import { Box, Text, useStdout } from "ink";
import type { View } from "./Sidebar.tsx";

interface StatusBarProps {
  view: View;
  connected: boolean;
  host: string;
}

const viewHints: Record<View, { full: string; short: string }> = {
  dashboard: { full: "r:refresh", short: "r:ref" },
  vms: { full: "j/k:navigate  Enter:select  s:start  x:stop  R:reboot  r:refresh", short: "j/k s x R r" },
  containers: { full: "j/k:navigate  Enter:select  s:start  x:stop  R:reboot  r:refresh", short: "j/k s x R r" },
  storage: { full: "j/k:navigate  r:refresh", short: "j/k r" },
};

export function StatusBar({ view, connected, host }: StatusBarProps) {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 80;
  const isNarrow = terminalWidth < 80;

  // Extract just hostname from URL for narrow displays
  const displayHost = isNarrow ? (() => {
    try {
      return new URL(host).hostname;
    } catch {
      return host;
    }
  })() : host;

  const hints = viewHints[view];

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      <Text dimColor wrap="truncate">{isNarrow ? hints.short : hints.full}</Text>
      <Box>
        <Text color={connected ? "green" : "red"}>
          {connected ? "●" : "○"}
        </Text>
        <Text dimColor wrap="truncate"> {displayHost}</Text>
      </Box>
    </Box>
  );
}
