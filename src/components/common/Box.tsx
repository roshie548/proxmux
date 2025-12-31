import React from "react";
import { Box as InkBox, Text } from "ink";
import type { BoxProps } from "ink";

interface BorderedBoxProps extends BoxProps {
  title?: string;
  children: React.ReactNode;
}

export function BorderedBox({ title, children, ...props }: BorderedBoxProps) {
  return (
    <InkBox
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      {...props}
    >
      {title && (
        <Text bold color="blue">
          {title}
        </Text>
      )}
      {children}
    </InkBox>
  );
}
