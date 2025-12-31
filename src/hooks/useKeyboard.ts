import { useInput } from "ink";
import { useState, useCallback } from "react";

export interface KeyboardNavigationOptions {
  itemCount: number;
  onSelect?: (index: number) => void;
  onBack?: () => void;
  enabled?: boolean;
}

export function useKeyboardNavigation({
  itemCount,
  onSelect,
  onBack,
  enabled = true,
}: KeyboardNavigationOptions) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const moveUp = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : itemCount - 1));
  }, [itemCount]);

  const moveDown = useCallback(() => {
    setSelectedIndex((prev) => (prev < itemCount - 1 ? prev + 1 : 0));
  }, [itemCount]);

  useInput(
    (input, key) => {
      if (!enabled) return;

      // Navigation
      if (input === "j" || key.downArrow) {
        moveDown();
      } else if (input === "k" || key.upArrow) {
        moveUp();
      } else if (input === "g") {
        setSelectedIndex(0);
      } else if (input === "G") {
        setSelectedIndex(itemCount - 1);
      }

      // Selection
      if (key.return && onSelect) {
        onSelect(selectedIndex);
      }

      // Back
      if ((input === "q" || key.escape) && onBack) {
        onBack();
      }
    },
    { isActive: enabled }
  );

  return {
    selectedIndex,
    setSelectedIndex,
    moveUp,
    moveDown,
  };
}

export interface ViewNavigationOptions {
  views: string[];
  onChange: (view: string) => void;
  enabled?: boolean;
}

export function useViewNavigation({
  views,
  onChange,
  enabled = true,
}: ViewNavigationOptions) {
  useInput(
    (input) => {
      if (!enabled) return;

      // Number keys for quick navigation
      const num = parseInt(input);
      if (num >= 1 && num <= views.length) {
        const view = views[num - 1];
        if (view) {
          onChange(view);
        }
      }
    },
    { isActive: enabled }
  );
}
