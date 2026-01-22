# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Interactive console access via Proxmox API (WebSocket-based, same as web UI)
- Password authentication for console with session caching (~2 hour expiry)
- Terminal title shows container name and exit hint (`Ctrl+\` to disconnect)
- Setup wizard hint in README (`proxmux --config`)
- `skipTlsVerify` config option for self-signed certificates (disabled by default)

### Changed
- Console no longer requires SSH configuration

### Security
- Session file restricted to owner-only permissions (0600)
- TLS verification enabled by default (opt-in to skip for self-signed certs)

## [0.4.0] - 2026-01-05

### Added
- Help modal with keyboard shortcuts (press `?`)
- Error modal for console connection failures with detailed SSH output
- Token ID parsing supports full format (`user@realm!token`)

### Fixed
- Console now shows detailed error messages instead of failing silently
- Modal overlays block input to underlying views
- Config prompt clarifies token name vs full token ID format

## [0.3.0] - 2026-01-01

### Added
- Container config editing (memory, swap, CPU cores, CPU limit, CPU units)
- Container options editing (hostname, start on boot, protection, startup order)
- Homebrew tap support (`brew install roshie548/tap/proxmux`)

### Changed
- Responsive UI improvements for narrow terminals
- Sidebar adapts width and uses short labels on narrow displays
- Container/VM lists hide optional columns (node, uptime) when space is limited
- Compact uptime format on narrow displays, full format when wide
- Dashboard summary boxes and progress bars adapt to terminal width
- All text elements use truncation to prevent line wrapping

## [0.2.2] - 2025-12-31

### Added
- Baseline x64 Linux build for older CPUs without AVX2 support
  - Use `proxmux-linux-x64-baseline` if you get "Illegal instruction" errors

## [0.2.1] - 2025-12-31

### Changed
- Updated to Node 22 for npm OIDC publishing support

### Fixed
- npm package publishing with provenance

## [0.2.0] - 2025-12-31

### Added
- Initial public release
- Dashboard with cluster overview (nodes, VMs, containers, resource usage)
- VM management (list, start, stop, reboot)
- Container management (list, start, stop, reboot)
- Storage overview
- Detail view with tabbed interface (Summary, Resources, Network, Options)
- Action mode for quick operations (press `a`)
- Console access via SSH (`pct console`)
- Confirmation dialogs for destructive actions
- Fullscreen terminal UI with vim-style navigation
- Cross-platform standalone binaries (macOS, Linux, Windows)
- npm package (`bunx proxmux`)
- GitHub Actions automated releases

[Unreleased]: https://github.com/roshie548/proxmux/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/roshie548/proxmux/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/roshie548/proxmux/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/roshie548/proxmux/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/roshie548/proxmux/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/roshie548/proxmux/releases/tag/v0.2.0
