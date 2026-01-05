import React from "react";
import { Box, Text, useInput } from "ink";

interface HelpOverlayProps {
  onClose: () => void;
}

export function HelpOverlay({ onClose }: HelpOverlayProps) {
  useInput((input, key) => {
    if (key.escape || input === "?" || input === "q" || key.return) {
      onClose();
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="cyan"
      padding={1}
      width={60}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Proxmux Help
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold underline>Navigation</Text>
        <Text>  <Text color="yellow">1-4</Text>       Switch views (Dashboard, VMs, Containers, Storage)</Text>
        <Text>  <Text color="yellow">j/k ↑/↓</Text>   Move up/down in lists</Text>
        <Text>  <Text color="yellow">Enter</Text>     Select item / Open detail view</Text>
        <Text>  <Text color="yellow">Esc</Text>       Go back / Cancel</Text>
        <Text>  <Text color="yellow">Tab</Text>       Next field (in forms)</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold underline>Actions</Text>
        <Text>  <Text color="yellow">c</Text>         Create new VM/Container</Text>
        <Text>  <Text color="yellow">s</Text>         Start VM/Container</Text>
        <Text>  <Text color="yellow">x</Text>         Stop VM/Container</Text>
        <Text>  <Text color="yellow">R</Text>         Reboot VM/Container</Text>
        <Text>  <Text color="yellow">r</Text>         Refresh current view</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold underline>General</Text>
        <Text>  <Text color="yellow">?</Text>         Show this help</Text>
        <Text>  <Text color="yellow">q</Text>         Quit proxmux</Text>
        <Text>  <Text color="yellow">Ctrl+C</Text>    Quit proxmux</Text>
      </Box>

      <Box flexDirection="column">
        <Text bold underline>Wizard Navigation</Text>
        <Text>  <Text color="yellow">Ctrl+N</Text>    Next step</Text>
        <Text>  <Text color="yellow">Ctrl+P</Text>    Previous step</Text>
        <Text>  <Text color="yellow">Tab</Text>       Next field</Text>
        <Text>  <Text color="yellow">Esc</Text>       Cancel / Go back</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Press Esc, ?, or Enter to close</Text>
      </Box>
    </Box>
  );
}
