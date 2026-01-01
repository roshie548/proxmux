import React, { useState, useEffect } from "react";
import { useApp, useInput, useStdout } from "ink";
import { Layout } from "./components/Layout.tsx";
import type { View } from "./components/Sidebar.tsx";
import { Dashboard } from "./views/Dashboard.tsx";
import { VMs } from "./views/VMs.tsx";
import { Containers } from "./views/Containers.tsx";
import { Storage } from "./views/Storage.tsx";
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
    // Skip global shortcuts when in edit mode
    if (isEditing) return;

    // View switching with number keys
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
        return <VMs />;
      case "containers":
        return <Containers host={config.host} />;
      case "storage":
        return <Storage />;
      default:
        return <Dashboard />;
    }
  };

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
