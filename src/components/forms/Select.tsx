import React from "react";
import { Box, Text, useInput } from "ink";

export interface SelectOption<T = string> {
  label: string;
  value: T;
  description?: string;
}

export interface SelectProps<T = string> {
  label: string;
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  isActive?: boolean;
  placeholder?: string;
  onOpenChange?: (isOpen: boolean) => void;
}

export function Select<T = string>({
  label,
  options,
  value,
  onChange,
  isActive = false,
  placeholder = "Select an option...",
  onOpenChange,
}: SelectProps<T>) {
  const [isOpen, setIsOpenState] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const [searchQuery, setSearchQuery] = React.useState("");

  const setIsOpen = React.useCallback((open: boolean) => {
    setIsOpenState(open);
    onOpenChange?.(open);
    if (!open) {
      setSearchQuery(""); // Clear search when closing
    }
  }, [onOpenChange]);

  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.description?.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.return) {
        if (isOpen) {
          const selected = filteredOptions[highlightedIndex];
          if (selected) {
            onChange(selected.value);
          }
          setIsOpen(false);
        } else {
          setIsOpen(true);
          const currentIndex = options.findIndex((opt) => opt.value === value);
          setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
        }
      } else if (key.escape) {
        if (searchQuery) {
          setSearchQuery(""); // First Esc clears search
          setHighlightedIndex(0);
        } else {
          setIsOpen(false);
        }
      } else if (key.backspace || key.delete) {
        if (isOpen && searchQuery) {
          setSearchQuery((prev) => prev.slice(0, -1));
          setHighlightedIndex(0);
        }
      } else if (isOpen) {
        if (key.upArrow) {
          setHighlightedIndex((prev) => Math.max(0, prev - 1));
        } else if (key.downArrow) {
          setHighlightedIndex((prev) => Math.min(filteredOptions.length - 1, prev + 1));
        } else if (input && !key.ctrl && !key.meta && input.length === 1) {
          // Type to search - append character to search query
          setSearchQuery((prev) => prev + input);
          setHighlightedIndex(0);
        }
      }
    },
    { isActive }
  );

  const displayValue = selectedOption?.label || placeholder;

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold={isActive} color={isActive ? "cyan" : undefined}>
          {label}:{" "}
        </Text>
        <Text color={isActive ? "cyan" : "gray"}>[</Text>
        <Text color={selectedOption ? undefined : "gray"}>
          {" "}{displayValue}{" "}
        </Text>
        <Text color={isActive ? "cyan" : "gray"}>]</Text>
        {isActive && !isOpen && <Text dimColor> ↵ to open</Text>}
      </Box>

      {isOpen && isActive && (
        <Box flexDirection="column" paddingLeft={label.length + 2}>
          {/* Search indicator */}
          <Box height={1} marginBottom={filteredOptions.length > 0 ? 0 : 0}>
            <Text color="yellow">
              {searchQuery ? `🔍 "${searchQuery}"` : "Type to search..."}
            </Text>
            <Text dimColor> ({filteredOptions.length} matches)</Text>
          </Box>
          {filteredOptions.length === 0 ? (
            <Box height={1}>
              <Text color="gray">No matches found</Text>
            </Box>
          ) : (
            filteredOptions.slice(0, 15).map((option, index) => (
              <Box key={String(option.value)} height={1}>
                <Text inverse={index === highlightedIndex}>
                  {option.value === value ? "● " : "○ "}
                  {option.label}
                </Text>
                {option.description && (
                  <Text dimColor> - {option.description}</Text>
                )}
              </Box>
            ))
          )}
          {filteredOptions.length > 15 && (
            <Box height={1}>
              <Text dimColor>... and {filteredOptions.length - 15} more (type to filter)</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
