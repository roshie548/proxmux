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
  // Ensure percent is valid and width is at least 1
  const safePercent = Math.max(0, Math.min(100, percent || 0));
  const safeWidth = Math.max(1, width);
  const filled = Math.max(0, Math.round((safePercent / 100) * safeWidth));
  const empty = Math.max(0, safeWidth - filled);

  let color: string;
  if (safePercent >= 90) {
    color = "red";
  } else if (safePercent >= 70) {
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
