import React from "react";
import { Box, Text, useStdout } from "ink";

interface HelpModalProps {
  height: number;
}

function Line({
  children,
  width,
}: {
  children: React.ReactNode;
  width: number;
}) {
  return (
    <Box width={width}>
      <Text backgroundColor="black">
        {children}
        {" ".repeat(Math.max(0, width - getTextLength(children)))}
      </Text>
    </Box>
  );
}

function getTextLength(node: React.ReactNode): number {
  if (typeof node === "string") return node.length;
  if (typeof node === "number") return String(node).length;
  if (Array.isArray(node))
    return node.reduce((acc, n) => acc + getTextLength(n), 0);
  if (React.isValidElement(node) && node.props.children) {
    return getTextLength(node.props.children);
  }
  return 0;
}

export function HelpModal({ height }: HelpModalProps) {
  const { stdout } = useStdout();
  const width = stdout?.columns || 80;
  const modalWidth = 42;

  return (
    <Box
      position="absolute"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      width={width}
      height={height}
    >
      <Box flexDirection="column" borderStyle="round" borderColor="cyan">
        <Line width={modalWidth}>
          <Text bold color="cyan">
            Keyboard Shortcuts
          </Text>
        </Line>
        <Line width={modalWidth}>{""}</Line>

        <Line width={modalWidth}>
          <Text bold dimColor>
            Navigation
          </Text>
        </Line>
        <Line width={modalWidth}>
          {" "}
          <Text bold>j/k</Text> or <Text bold>↑/↓</Text> Move up/down
        </Line>
        <Line width={modalWidth}>
          {" "}
          <Text bold>Enter</Text> Select item
        </Line>
        <Line width={modalWidth}>
          {" "}
          <Text bold>Esc</Text> Go back
        </Line>
        <Line width={modalWidth}>{""}</Line>

        <Line width={modalWidth}>
          <Text bold dimColor>
            Views
          </Text>
        </Line>
        <Line width={modalWidth}>
          {" "}
          <Text bold>1</Text> Dashboard
        </Line>
        <Line width={modalWidth}>
          {" "}
          <Text bold>2</Text> VMs
        </Line>
        <Line width={modalWidth}>
          {" "}
          <Text bold>3</Text> Containers
        </Line>
        <Line width={modalWidth}>
          {" "}
          <Text bold>4</Text> Storage
        </Line>
        <Line width={modalWidth}>{""}</Line>

        <Line width={modalWidth}>
          <Text bold dimColor>
            Actions
          </Text>
        </Line>
        <Line width={modalWidth}>
          {" "}
          <Text bold>s</Text> Start VM/container
        </Line>
        <Line width={modalWidth}>
          {" "}
          <Text bold>x</Text> Stop VM/container
        </Line>
        <Line width={modalWidth}>
          {" "}
          <Text bold>R</Text> Reboot VM/container
        </Line>
        <Line width={modalWidth}>
          {" "}
          <Text bold>r</Text> Refresh
        </Line>
        <Line width={modalWidth}>{""}</Line>

        <Line width={modalWidth}>
          <Text bold dimColor>
            General
          </Text>
        </Line>
        <Line width={modalWidth}>
          {" "}
          <Text bold>?</Text> Toggle this help
        </Line>
        <Line width={modalWidth}>
          {" "}
          <Text bold>q</Text> Quit
        </Line>
        <Line width={modalWidth}>{""}</Line>

        <Line width={modalWidth}>
          <Text dimColor>Press ? or Esc to close</Text>
        </Line>
      </Box>
    </Box>
  );
}
