import React from "react";
import { Box, Text, useInput } from "ink";
import { useStorage } from "../hooks/useProxmox.ts";
import { useKeyboardNavigation } from "../hooks/useKeyboard.ts";
import { Spinner } from "../components/common/Spinner.tsx";
import { ProgressBar } from "../components/common/ProgressBar.tsx";
import { formatBytes } from "../utils/format.ts";

export function Storage() {
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
        <Text bold color="blue">
          Storage
        </Text>
        <Text dimColor> ({storage.length})</Text>
        {loading && <Text dimColor> (refreshing...)</Text>}
      </Box>

      {/* Header */}
      <Box>
        <Box width={4}>
          <Text bold dimColor>ST</Text>
        </Box>
        <Box width={16}>
          <Text bold dimColor>NAME</Text>
        </Box>
        <Box width={12}>
          <Text bold dimColor>TYPE</Text>
        </Box>
        <Box width={20}>
          <Text bold dimColor>CONTENT</Text>
        </Box>
        <Box width={30}>
          <Text bold dimColor>USAGE</Text>
        </Box>
      </Box>

      {/* Storage */}
      {storage.map((store, index) => {
        const isSelected = index === selectedIndex;
        const usedPercent =
          store.total > 0 ? (store.used / store.total) * 100 : 0;

        return (
          <Box key={store.storage}>
            <Text inverse={isSelected}>
              <Text color={store.active ? "green" : "red"}>
                {store.active ? "●" : "○"}
              </Text>
              <Text> </Text>
            </Text>
            <Text inverse={isSelected}>{store.storage.padEnd(15)}</Text>
            <Text inverse={isSelected} dimColor={!isSelected}>{store.type.padEnd(11)}</Text>
            <Text inverse={isSelected} dimColor={!isSelected}>{store.content.padEnd(19)}</Text>
            {store.total > 0 ? (
              <Box>
                <ProgressBar percent={usedPercent} width={12} showPercent={false} />
                <Text dimColor>
                  {" "}{formatBytes(store.used)}/{formatBytes(store.total)}
                </Text>
              </Box>
            ) : (
              <Text dimColor>-</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
