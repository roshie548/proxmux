import React from "react";
import { Text } from "ink";

type Status = "running" | "stopped" | "paused" | "online" | "offline";

const statusConfig: Record<Status, { symbol: string; color: string }> = {
  running: { symbol: "●", color: "green" },
  online: { symbol: "●", color: "green" },
  stopped: { symbol: "●", color: "red" },
  offline: { symbol: "●", color: "red" },
  paused: { symbol: "●", color: "yellow" },
};

interface StatusBadgeProps {
  status: Status;
  showLabel?: boolean;
}

export function StatusBadge({ status, showLabel = true }: StatusBadgeProps) {
  const config = statusConfig[status] || { symbol: "○", color: "gray" };

  return (
    <Text>
      <Text color={config.color as any}>{config.symbol}</Text>
      {showLabel && <Text> {status}</Text>}
    </Text>
  );
}
