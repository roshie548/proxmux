import React, { useState, useEffect } from "react";
import { useApp, useInput, useStdout, Box } from "ink";
import { Layout } from "./components/Layout.tsx";
import type { View } from "./components/Sidebar.tsx";
import { Dashboard } from "./views/Dashboard.tsx";
import { VMs } from "./views/VMs.tsx";
import { Containers } from "./views/Containers.tsx";
import { Storage } from "./views/Storage.tsx";
import { HelpOverlay } from "./components/common/HelpOverlay.tsx";
import type { ProxmuxConfig } from "./config/index.ts";
import { getClient } from "./api/client.ts";
import { useEditMode } from "./context/EditModeContext.tsx";

interface AppProps {
  config: ProxmuxConfig;
}

const views: View[] = ["dashboard", "vms", "containers", "storage"];

export function App({ config }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const { isEditing } = useEditMode();
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [connected, setConnected] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(stdout?.rows || 24);
  const [showHelp, setShowHelp] = useState(false);
  const [formActive, setFormActive] = useState(false);

  // Update height when terminal resizes
  useEffect(() => {
    const handleResize = () => {
      setTerminalHeight(stdout?.rows || 24);
    };
    stdout?.on("resize", handleResize);
    return () => {
      stdout?.off("resize", handleResize);
    };
  }, [stdout]);

  // Test connection on mount
  useEffect(() => {
    getClient()
      .testConnection()
      .then(setConnected)
      .catch(() => setConnected(false));
  }, []);

  // Global keyboard shortcuts (handles view switching and quit)
  useInput((input, key) => {
    // Help toggle
    if (input === "?") {
      setShowHelp((prev) => !prev);
      return;
    }

    // Don't process other keys when help is shown
    if (showHelp) return;

    // Skip global shortcuts when in edit mode or form active
    if (isEditing || formActive) return;

    // View switching with number keys (only when not in a form)
    const num = parseInt(input);
    if (num >= 1 && num <= views.length) {
      const view = views[num - 1];
      if (view) {
        setCurrentView(view as View);
      }
    }

    // Quit
    if (input === "q" && !key.ctrl) {
      exit();
    }
    // Ctrl+C
    if (key.ctrl && input === "c") {
      exit();
    }
  });

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return <Dashboard />;
      case "vms":
        return <VMs onFormActiveChange={setFormActive} />;
      case "containers":
        return <Containers host={config.host} onFormActiveChange={setFormActive} />;
      case "storage":
        return <Storage />;
      default:
        return <Dashboard />;
    }
  };

  if (showHelp) {
    return (
      <Box flexDirection="column" padding={1}>
        <HelpOverlay onClose={() => setShowHelp(false)} />
      </Box>
    );
  }

  return (
    <Layout
      currentView={currentView}
      onViewChange={setCurrentView}
      connected={connected}
      host={config.host}
      height={terminalHeight}
    >
      {renderView()}
    </Layout>
  );
}
