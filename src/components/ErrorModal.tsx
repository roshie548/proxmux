import React from "react";
import { Box, Text, useStdout } from "ink";

interface ErrorModalProps {
  title: string;
  error: string;
  height: number;
}

function sanitize(str: string): string {
  return str
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/\r/g, "")
    .replace(/[\x00-\x09\x0b-\x1f\x7f]/g, "");
}

function Line({ children, width }: { children: string; width: number }) {
  const text = sanitize(children || "");
  const truncated = text.length > width ? text.slice(0, width - 1) + "…" : text;
  const padLength = Math.max(0, width - truncated.length);

  return (
    <Box width={width}>
      <Text backgroundColor="black">
        {truncated}
        {" ".repeat(padLength)}
      </Text>
    </Box>
  );
}

export function ErrorModal({ title, error, height }: ErrorModalProps) {
  const { stdout } = useStdout();
  const width = stdout?.columns || 80;

  const sanitizedError = sanitize(error);
  const lines = sanitizedError.split("\n");

  const modalWidth = 68;

  return (
    <Box
      position="absolute"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      width={width}
      height={height}
    >
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="red"
      >
        <Line width={modalWidth}>{title}</Line>
        <Line width={modalWidth}>{""}</Line>

        {lines.map((line, i) => (
          <Line key={i} width={modalWidth}>{line}</Line>
        ))}

        <Line width={modalWidth}>{""}</Line>
        <Line width={modalWidth}>{"Press any key to close"}</Line>
      </Box>
    </Box>
  );
}
