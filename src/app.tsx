import React, { useState, useEffect } from "react";
import { Box, useApp, useInput, useStdout } from "ink";
import { Layout } from "./components/Layout.tsx";
import { HelpModal } from "./components/HelpModal.tsx";
import { ErrorModal } from "./components/ErrorModal.tsx";
import type { View } from "./components/Sidebar.tsx";
import { Dashboard } from "./views/Dashboard.tsx";
import { VMs } from "./views/VMs.tsx";
import { Containers } from "./views/Containers.tsx";
import { Storage } from "./views/Storage.tsx";
import type { ProxmuxConfig } from "./config/index.ts";
import { getClient } from "./api/client.ts";
import { useEditMode } from "./context/EditModeContext.tsx";
import { useModal } from "./context/ModalContext.tsx";

interface AppProps {
  config: ProxmuxConfig;
}

const views: View[] = ["dashboard", "vms", "containers", "storage"];

export function App({ config }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const { isEditing } = useEditMode();
  const { isModalOpen, openModal, closeModal } = useModal();
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [connected, setConnected] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(stdout?.rows || 24);
  const [showHelp, setShowHelp] = useState(false);
  const [appError, setAppError] = useState<{ title: string; message: string } | null>(null);
  const [consoleActive, setConsoleActive] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

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

  useEffect(() => {
    if (showHelp) {
      openModal("help");
    } else {
      closeModal("help");
    }
  }, [showHelp, openModal, closeModal]);

  useEffect(() => {
    if (appError) {
      openModal("error");
    } else {
      closeModal("error");
    }
  }, [appError, openModal, closeModal]);

  useInput((input, key) => {
    // Dismiss error modal on any key
    if (appError) {
      setAppError(null);
      return;
    }

    if (isEditing || consoleActive || isModalOpen) return;

    if (input === "?") {
      setShowHelp((prev) => !prev);
      return;
    }

    if (showHelp && key.escape) {
      setShowHelp(false);
      return;
    }

    if (showHelp) return;

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

  const modalOpen = showHelp || !!appError;

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return <Dashboard />;
      case "vms":
        return <VMs modalOpen={modalOpen} />;
      case "containers":
        return <Containers
          modalOpen={modalOpen}
          onError={(title, message) => setAppError({ title, message })}
          onConsoleActiveChange={(active) => {
            setConsoleActive(prev => {
              if (prev && !active) {
                setRenderKey(k => k + 1);
              }
              return active;
            });
          }}
        />;
      case "storage":
        return <Storage />;
      default:
        return <Dashboard />;
    }
  };

  if (consoleActive) {
    return <Box />;
  }

  return (
    <>
      <Layout
        key={renderKey}
        currentView={currentView}
        onViewChange={setCurrentView}
        connected={connected}
        host={config.host}
        height={terminalHeight}
      >
        {renderView()}
      </Layout>
      {showHelp && <HelpModal height={terminalHeight} />}
      {appError && <ErrorModal title={appError.title} error={appError.message} height={terminalHeight} />}
    </>
  );
}
