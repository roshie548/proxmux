import React, { useState, useEffect } from "react";
import { useApp, useInput } from "ink";
import { Layout } from "./components/Layout.tsx";
import type { View } from "./components/Sidebar.tsx";
import { Dashboard } from "./views/Dashboard.tsx";
import { VMs } from "./views/VMs.tsx";
import { Containers } from "./views/Containers.tsx";
import { Storage } from "./views/Storage.tsx";
import { loadConfig, type ProxmuxConfig } from "./config/index.ts";
import { initClient, getClient } from "./api/client.ts";
import { useViewNavigation } from "./hooks/useKeyboard.ts";

interface AppProps {
  config: ProxmuxConfig;
}

const views: View[] = ["dashboard", "vms", "containers", "storage"];

export function App({ config }: AppProps) {
  const { exit } = useApp();
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [connected, setConnected] = useState(false);

  // Initialize client and test connection
  useEffect(() => {
    initClient(config);
    getClient()
      .testConnection()
      .then(setConnected)
      .catch(() => setConnected(false));
  }, [config]);

  // View navigation with number keys
  useViewNavigation({
    views,
    onChange: (view) => setCurrentView(view as View),
  });

  // Global keyboard shortcuts
  useInput((input, key) => {
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
        return <Containers />;
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
    >
      {renderView()}
    </Layout>
  );
}
