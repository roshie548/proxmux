import React from "react";
import { Text } from "ink";

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function Spinner({ label }: { label?: string }) {
  const [frameIndex, setFrameIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <Text>
      <Text color="cyan">{frames[frameIndex]}</Text>
      {label && <Text> {label}</Text>}
    </Text>
  );
}
