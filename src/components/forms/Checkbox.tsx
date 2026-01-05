import React from "react";
import { Box, Text, useInput } from "ink";

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  isActive?: boolean;
  description?: string;
}

export function Checkbox({
  label,
  checked,
  onChange,
  isActive = false,
  description,
}: CheckboxProps) {
  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.return || input === " ") {
        onChange(!checked);
      }
    },
    { isActive }
  );

  return (
    <Box>
      <Text bold={isActive} color={isActive ? "cyan" : undefined}>
        {checked ? "☑" : "☐"} {label}
      </Text>
      {description && <Text dimColor> - {description}</Text>}
      {isActive && <Text dimColor> [Space/Enter to toggle]</Text>}
    </Box>
  );
}
