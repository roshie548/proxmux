# proxmux

A terminal UI for managing Proxmox VE, built with [Ink](https://github.com/vadimdemedes/ink) and [Bun](https://bun.sh).

<img width="1080" height="759" alt="image" src="https://github.com/user-attachments/assets/c6805b47-71fc-4115-8322-8e1e272c0ed6" />


## Features

- **Dashboard** - Overview of cluster nodes with CPU, memory, and disk usage
- **VM Management** - List, start, stop, and reboot virtual machines
- **Container Management** - List, start, stop, and reboot LXC containers
- **Console Access** - Interactive terminal access to containers via Proxmox API
- **Storage View** - View storage pools and usage
- **Detail View** - Detailed info for VMs/containers including network, resources, and config
- **Vim-style Navigation** - Use `j`/`k` or arrow keys to navigate
- **Responsive UI** - Adapts to terminal size

## Requirements

- Proxmox VE with API access
- API token (recommended) or user credentials

## Installation

### Homebrew (macOS/Linux)

```bash
brew install roshie548/tap/proxmux
```

### npm

Requires [Bun](https://bun.sh) runtime.

```bash
bunx proxmux
```

Or install globally:

```bash
bun install -g proxmux
proxmux
```

### Standalone Binary

Download the latest binary for your platform from [Releases](https://github.com/roshie548/proxmux/releases):

- **macOS Apple Silicon**: `proxmux-darwin-arm64`
- **macOS Intel**: `proxmux-darwin-x64`
- **Linux x64**: `proxmux-linux-x64`
- **Linux ARM64**: `proxmux-linux-arm64`
- **Windows**: `proxmux-windows-x64.exe`

```bash
chmod +x proxmux-*
./proxmux-darwin-arm64  # or your platform
```

### From source

```bash
# Clone the repository
git clone https://github.com/roshie548/proxmux.git
cd proxmux

# Install dependencies
bun install

# Run
bun run start
```

## Configuration

Run the setup wizard:

```bash
proxmux --config
```

Or create a config file manually at `~/.config/proxmux/config.json`:

```json
{
  "host": "https://your-proxmox-host:8006",
  "user": "root@pam",
  "tokenId": "your-token-id",
  "tokenSecret": "your-token-secret"
}
```

### Creating an API Token in Proxmox

1. Go to **Datacenter** > **Permissions** > **API Tokens**
2. Click **Add**
3. Select user (e.g., `root@pam`)
4. Enter a Token ID (e.g., `proxmux`)
5. **Uncheck** "Privilege Separation" to inherit the user's permissions
6. Copy the token secret (shown only once)

> **Note:** If you leave "Privilege Separation" checked, you must manually assign permissions to the token under **Datacenter** > **Permissions**. The token needs at minimum:
> - `VM.Audit` - List and view VMs/containers
> - `VM.PowerMgmt` - Start, stop, and reboot VMs/containers
> - `Datastore.Audit` - View storage
> - `VM.Console` or `Sys.Console` - Access container/VM console (optional)
>
> These permissions should be set on `/` (or specific paths like `/vms` and `/storage`).

### Environment Variables

Alternatively, use environment variables:

```bash
export PROXMOX_HOST="https://your-proxmox-host:8006"
export PROXMOX_USER="root@pam"
export PROXMOX_TOKEN_ID="your-token-id"
export PROXMOX_TOKEN_SECRET="your-token-secret"
```

## Keyboard Shortcuts

### Global

| Key | Action |
|-----|--------|
| `1-4` | Switch views (Dashboard, VMs, Containers, Storage) |
| `Tab` | Cycle through views |
| `q` | Quit |
| `Ctrl+C` | Quit |

### Navigation

| Key | Action |
|-----|--------|
| `j` / `↓` | Move down |
| `k` / `↑` | Move up |
| `Enter` | Open detail view / Confirm action |
| `Esc` | Go back / Cancel |

### Actions

| Key | Action |
|-----|--------|
| `r` | Refresh data |
| `s` | Start VM/Container |
| `x` | Stop VM/Container (with confirmation) |
| `R` | Reboot VM/Container (with confirmation) |

### Detail View

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate actions |
| `Enter` | Execute selected action |
| `Esc` / `q` | Go back to list |

### Console (Containers)

Select "Console" in the detail view to open an interactive terminal session. This uses the Proxmox API (same as the web UI) - no SSH configuration required. Type `exit` or press `Ctrl+\` to return to proxmux.

## Development

```bash
# Run with hot reload
bun run dev

# Type check
bun run --bun tsc --noEmit
```

## License

MIT License - see [LICENSE](LICENSE) for details.
