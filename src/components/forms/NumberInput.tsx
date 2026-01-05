import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";

export interface NumberInputProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  isActive?: boolean;
  required?: boolean;
  placeholder?: string;
}

export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  isActive = false,
  required = false,
  placeholder = "",
}: NumberInputProps) {
  const [inputValue, setInputValue] = useState(value?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInputValue(value?.toString() ?? "");
  }, [value]);

  useEffect(() => {
    const num = parseFloat(inputValue);
    if (required && !inputValue.trim()) {
      setError("This field is required");
    } else if (inputValue && isNaN(num)) {
      setError("Must be a number");
    } else if (min !== undefined && num < min) {
      setError(`Minimum: ${min}${unit ? ` ${unit}` : ""}`);
    } else if (max !== undefined && num > max) {
      setError(`Maximum: ${max}${unit ? ` ${unit}` : ""}`);
    } else {
      setError(null);
    }
  }, [inputValue, min, max, required, unit]);

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.backspace || key.delete) {
        const newValue = inputValue.slice(0, -1);
        setInputValue(newValue);
        const num = parseFloat(newValue);
        onChange(isNaN(num) ? null : num);
      } else if (key.upArrow) {
        const current = value ?? (min ?? 0);
        const newValue = max !== undefined ? Math.min(max, current + step) : current + step;
        onChange(newValue);
      } else if (key.downArrow) {
        const current = value ?? (min ?? 0);
        const newValue = min !== undefined ? Math.max(min, current - step) : current - step;
        onChange(newValue);
      } else if (!key.return && !key.escape && !key.tab && input) {
        // Only allow numeric input and decimal point
        if (/^[\d.]$/.test(input)) {
          const newValue = inputValue + input;
          setInputValue(newValue);
          const num = parseFloat(newValue);
          if (!isNaN(num)) {
            onChange(num);
          }
        }
      }
    },
    { isActive }
  );

  const displayValue = inputValue || placeholder;
  const showPlaceholder = !inputValue && placeholder;

  const bracketColor = error ? "red" : isActive ? "cyan" : "gray";

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold={isActive} color={isActive ? "cyan" : undefined}>
          {label}:{" "}
        </Text>
        <Text color={bracketColor}>[</Text>
        <Text color={showPlaceholder ? "gray" : undefined}>
          {" "}{isActive ? displayValue + "█" : displayValue}{" "}
        </Text>
        <Text color={bracketColor}>]</Text>
        {unit && <Text dimColor> {unit}</Text>}
        {isActive && (
          <Text dimColor> ↑/↓ ±{step}</Text>
        )}
      </Box>
      {error && isActive && (
        <Box paddingLeft={label.length + 2}>
          <Text color="red" dimColor>
            {error}
          </Text>
        </Box>
      )}
    </Box>
  );
}
