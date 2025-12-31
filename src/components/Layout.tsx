import React from "react";
import { Box } from "ink";
import { Sidebar, type View } from "./Sidebar.tsx";
import { StatusBar } from "./StatusBar.tsx";

interface LayoutProps {
  currentView: View;
  onViewChange: (view: View) => void;
  connected: boolean;
  host: string;
  children: React.ReactNode;
}

export function Layout({
  currentView,
  onViewChange,
  connected,
  host,
  children,
}: LayoutProps) {
  return (
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1}>
        <Sidebar currentView={currentView} onViewChange={onViewChange} />
        <Box flexGrow={1} flexDirection="column" paddingX={1}>
          {children}
        </Box>
      </Box>
      <StatusBar view={currentView} connected={connected} host={host} />
    </Box>
  );
}
