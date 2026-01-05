import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";

export interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isActive?: boolean;
  validator?: (value: string) => string | null; // Returns error message or null
  required?: boolean;
  password?: boolean;
  width?: number;
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder = "",
  isActive = false,
  validator,
  required = false,
  password = false,
  width = 30,
}: TextInputProps) {
  const [cursorPosition, setCursorPosition] = useState(value.length);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCursorPosition(value.length);
  }, [value.length]);

  useEffect(() => {
    if (validator) {
      setError(validator(value));
    } else if (required && !value.trim()) {
      setError("This field is required");
    } else {
      setError(null);
    }
  }, [value, validator, required]);

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.backspace || key.delete) {
        if (cursorPosition > 0) {
          const newValue = value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
          onChange(newValue);
          setCursorPosition(cursorPosition - 1);
        }
      } else if (key.leftArrow) {
        setCursorPosition(Math.max(0, cursorPosition - 1));
      } else if (key.rightArrow) {
        setCursorPosition(Math.min(value.length, cursorPosition + 1));
      } else if (!key.return && !key.escape && !key.tab && !key.upArrow && !key.downArrow && input) {
        const newValue = value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
        onChange(newValue);
        setCursorPosition(cursorPosition + input.length);
      }
    },
    { isActive }
  );

  const displayValue = password ? "•".repeat(value.length) : value;
  const showPlaceholder = !value && placeholder;

  // Build the display with cursor
  let displayText = "";
  if (showPlaceholder) {
    displayText = placeholder;
  } else if (isActive) {
    displayText =
      displayValue.slice(0, cursorPosition) +
      "█" +
      displayValue.slice(cursorPosition);
  } else {
    displayText = displayValue || " ";
  }

  const bracketColor = error ? "red" : isActive ? "cyan" : "gray";

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold={isActive} color={isActive ? "cyan" : undefined}>
          {label}:{" "}
        </Text>
        <Text color={bracketColor}>[</Text>
        <Text
          color={showPlaceholder ? "gray" : undefined}
          dimColor={!isActive && !showPlaceholder}
        >
          {" "}{displayText.slice(0, width - 4)}{" "}
        </Text>
        <Text color={bracketColor}>]</Text>
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
