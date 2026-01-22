import React, { useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";

interface PasswordModalProps {
  username: string;
  host: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
  error?: string;
  loading?: boolean;
  height: number;
}

export function PasswordModal({
  username,
  host,
  onSubmit,
  onCancel,
  error,
  loading,
  height,
}: PasswordModalProps) {
  const { stdout } = useStdout();
  const width = stdout?.columns || 80;
  const [password, setPassword] = useState("");

  useInput(
    (input, key) => {
      if (loading) return;

      if (key.escape) {
        onCancel();
        return;
      }

      if (key.return) {
        if (password.length > 0) {
          onSubmit(password);
        }
        return;
      }

      if (key.backspace || key.delete) {
        setPassword((p) => p.slice(0, -1));
        return;
      }

      // Add printable characters (ignore control keys)
      if (input && !key.ctrl && !key.meta && input.length === 1) {
        setPassword((p) => p + input);
      }
    },
    { isActive: !loading }
  );

  const modalWidth = 50;
  const maskedPassword = "*".repeat(password.length);

  return (
    <Box
      position="absolute"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      width={width}
      height={height}
    >
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="yellow"
        paddingX={2}
        paddingY={1}
      >
        <Box width={modalWidth} justifyContent="center" marginBottom={1}>
          <Text bold color="yellow">
            Console Authentication
          </Text>
        </Box>

        <Box width={modalWidth}>
          <Text>
            Enter password for <Text bold>{username}</Text>
          </Text>
        </Box>
        <Box width={modalWidth} marginBottom={1}>
          <Text dimColor>Host: {host}</Text>
        </Box>

        <Box width={modalWidth} marginBottom={1}>
          <Text>Password: </Text>
          <Text>{maskedPassword}</Text>
          <Text color="cyan">{loading ? "" : "█"}</Text>
        </Box>

        {error && (
          <Box width={modalWidth} marginBottom={1}>
            <Text color="red">{error}</Text>
          </Box>
        )}

        {loading ? (
          <Box width={modalWidth}>
            <Text dimColor>Authenticating...</Text>
          </Box>
        ) : (
          <Box width={modalWidth}>
            <Text dimColor>Enter to submit, Escape to cancel</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
