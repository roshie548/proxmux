import React from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { useStorage } from "../hooks/useProxmox.ts";
import { useKeyboardNavigation } from "../hooks/useKeyboard.ts";
import { Spinner } from "../components/common/Spinner.tsx";
import { ProgressBar } from "../components/common/ProgressBar.tsx";
import { formatBytes, truncate } from "../utils/format.ts";

export function Storage() {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 80;
  const contentWidth = Math.max(40, terminalWidth - 16);

  // Responsive column widths
  const isNarrow = contentWidth < 55;
  const isWide = contentWidth >= 80;
  const cols = {
    status: 2,
    name: isNarrow ? 10 : 14,
    type: isNarrow ? 6 : 8,
    content: isNarrow ? 0 : isWide ? 16 : 12,
    usage: isNarrow ? 12 : isWide ? 24 : 18,
  };

  const { storage, loading, error, refresh } = useStorage();

  const { selectedIndex } = useKeyboardNavigation({
    itemCount: storage.length,
  });

  useInput((input) => {
    if (input === "r") {
      refresh();
    }
  });

  if (loading && storage.length === 0) {
    return <Spinner label="Loading storage..." />;
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (storage.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold color="blue">Storage</Text>
        <Text dimColor>No storage found</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="blue">Storage</Text>
        <Text dimColor> ({storage.length})</Text>
        {loading && <Text dimColor> (refreshing...)</Text>}
      </Box>

      <Box>
        <Box width={cols.status}><Text bold dimColor wrap="truncate">S</Text></Box>
        <Box width={cols.name}><Text bold dimColor wrap="truncate">NAME</Text></Box>
        <Box width={cols.type}><Text bold dimColor wrap="truncate">TYPE</Text></Box>
        {cols.content > 0 && <Box width={cols.content}><Text bold dimColor wrap="truncate">CONTENT</Text></Box>}
        <Box width={cols.usage}><Text bold dimColor wrap="truncate">USAGE</Text></Box>
      </Box>

      {storage.map((store, index) => {
        const isSelected = index === selectedIndex;
        const usedPercent = store.total > 0 ? (store.used / store.total) * 100 : 0;
        const barWidth = Math.max(6, cols.usage - 12);

        return (
          <Box key={store.storage}>
            <Box width={cols.status}>
              <Text inverse={isSelected} color={store.active ? "green" : "red"}>
                {store.active ? "●" : "○"}
              </Text>
            </Box>
            <Box width={cols.name}>
              <Text inverse={isSelected} wrap="truncate">{truncate(store.storage, cols.name - 1)}</Text>
            </Box>
            <Box width={cols.type}>
              <Text inverse={isSelected} dimColor={!isSelected} wrap="truncate">{truncate(store.type, cols.type - 1)}</Text>
            </Box>
            {cols.content > 0 && (
              <Box width={cols.content}>
                <Text inverse={isSelected} dimColor={!isSelected} wrap="truncate">{truncate(store.content, cols.content - 1)}</Text>
              </Box>
            )}
            <Box width={cols.usage}>
              {store.total > 0 ? (
                <>
                  <ProgressBar percent={usedPercent} width={barWidth} showPercent={false} />
                  <Text dimColor wrap="truncate"> {formatBytes(store.used)}</Text>
                </>
              ) : (
                <Text dimColor>-</Text>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
