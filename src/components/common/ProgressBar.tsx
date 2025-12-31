import React from "react";
import { Text } from "ink";

interface ProgressBarProps {
  percent: number;
  width?: number;
  showPercent?: boolean;
}

export function ProgressBar({
  percent,
  width = 20,
  showPercent = true,
}: ProgressBarProps) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;

  let color: string;
  if (percent >= 90) {
    color = "red";
  } else if (percent >= 70) {
    color = "yellow";
  } else {
    color = "green";
  }

  return (
    <Text>
      <Text color="gray">[</Text>
      <Text color={color as any}>{"█".repeat(filled)}</Text>
      <Text color="gray">{"░".repeat(empty)}</Text>
      <Text color="gray">]</Text>
      {showPercent && <Text> {percent.toFixed(0)}%</Text>}
    </Text>
  );
}
