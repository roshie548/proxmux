/**
 * Terminal WebSocket utility for Proxmox console access
 *
 * Uses a simple pass-through approach - the remote terminal controls the display.
 * Exit with Ctrl+\ (SIGQUIT character) which is reliable across terminals.
 */

import WebSocket from "ws";

interface TerminalOptions {
  wsUrl: string;
  user: string;
  ticket: string;
  cookie?: string;  // PVEAuthCookie for session-based auth (required for console)
  origin?: string;  // Origin header for WebSocket
  onError?: (error: string) => void;
}

export async function connectTerminal(options: TerminalOptions): Promise<void> {
  const { wsUrl, user, ticket, cookie, origin, onError } = options;

  return new Promise((resolve, reject) => {
    let isConnected = false;
    let cleanedUp = false;
    let connectionTimeout: ReturnType<typeof setTimeout> | null = null;
    let stdinHandler: ((data: Buffer) => void) | null = null;
    let resizeHandler: (() => void) | null = null;

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;

      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
      if (stdinHandler) {
        process.stdin.removeListener("data", stdinHandler);
      }
      if (resizeHandler) {
        process.stdout.removeListener("resize", resizeHandler);
      }
      if (process.stdin.isTTY) {
        process.stdin.setRawMode?.(false);
      }
      process.stdout.write("\x1b[?25h");
    };

    const handleError = (error: string) => {
      cleanup();
      if (onError) onError(error);
      reject(new Error(error));
    };

    try {
      connectionTimeout = setTimeout(() => {
        if (!isConnected) {
          handleError("Connection timed out after 10 seconds.");
        }
      }, 10000);

      const headers: Record<string, string> = {};
      if (cookie) {
        headers["Cookie"] = cookie;
      }
      if (origin) {
        headers["Origin"] = origin;
      }

      const wsOptions: WebSocket.ClientOptions = {
        rejectUnauthorized: false,
        handshakeTimeout: 10000,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      };

      const ws = new WebSocket(wsUrl, ["binary"], wsOptions);

      ws.on("open", () => {
        isConnected = true;

        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          connectionTimeout = null;
        }

        if (process.stdin.isTTY) {
          process.stdin.setRawMode?.(true);
        }
        process.stdin.resume();
        process.stdout.write("\x1b[2J\x1b[H");

        const authString = `${user}:${ticket}\n`;
        ws.send(authString);

        stdinHandler = (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            if (data.length === 1 && data[0] === 0x1C) {
              ws.close();
              return;
            }

            const str = data.toString("utf8");
            ws.send(`0:${str.length}:${str}`);
          }
        };
        process.stdin.on("data", stdinHandler);

        resizeHandler = () => {
          if (ws.readyState === WebSocket.OPEN) {
            const cols = process.stdout.columns;
            const rows = process.stdout.rows;
            ws.send(`1:${cols}:${rows}:`);
          }
        };
        process.stdout.on("resize", resizeHandler);

        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const cols = process.stdout.columns;
            const rows = process.stdout.rows;
            ws.send(`1:${cols}:${rows}:`);
          }
        }, 300);
      });

      ws.on("message", (data: WebSocket.Data) => {
        if (Buffer.isBuffer(data)) {
          process.stdout.write(data);
        } else {
          process.stdout.write(data.toString());
        }
      });

      ws.on("close", (code: number) => {
        if (!isConnected) {
          handleError(`WebSocket failed (code: ${code})`);
          return;
        }
        cleanup();
        resolve();
      });

      ws.on("error", (err: Error) => {
        handleError(`WebSocket error: ${err.message}`);
      });

    } catch (error) {
      handleError(error instanceof Error ? error.message : "Failed to connect");
    }
  });
}
