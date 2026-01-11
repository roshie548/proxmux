# Technical Proposal: SSH Config Auto-Detection

**Status:** Proposed
**Author:** Claude
**Date:** 2025-01-10
**Related Issue:** GitHub comment requesting ~/.ssh/config support

---

## 1. Problem Statement

### Current State
The container console feature requires SSH access to the Proxmox host to run `pct console`. We recently added configurable SSH settings (`sshUser`, `sshPort`, `sshHost`) to support users with non-standard SSH setups.

### The Gap
During onboarding (`proxmux --config`), users must manually enter SSH settings even if they already have a perfectly configured `~/.ssh/config` entry for their Proxmox host. This creates:

1. **Redundant configuration** - Users re-enter info that already exists
2. **Potential for mismatch** - Manual entry can introduce typos or inconsistencies
3. **Poor UX for security-conscious users** - The exact audience who disables root login and uses non-standard ports

### Goal
Auto-detect existing SSH configurations and offer to use them during onboarding, reducing friction for users who have already configured SSH access to their Proxmox server.

---

## 2. Chosen Solution

### Approach
Parse `~/.ssh/config` during the onboarding flow, find entries that match the Proxmox hostname, and suggest using them.

### Why This Approach
- **Respects existing configuration** - Honors the user's SSH setup
- **Reduces errors** - No manual re-entry of port/user
- **Opt-in** - User confirms before we use detected settings
- **Graceful fallback** - If no match found, falls back to manual entry

### What We're NOT Doing
- Full SSH config parser with Include support (too complex, diminishing returns)
- Wildcard matching (ambiguous which config applies)
- SSH connectivity testing during setup (slow, may require interaction)

---

## 3. User Experience

### Flow A: SSH Config Match Found

```
$ proxmux --config

Configure Proxmox connection

Proxmox host URL (e.g., https://192.168.1.100:8006): https://192.168.1.100:8006
User (e.g., root@pam): root@pam
API token name (e.g., proxmux): proxmux
API token secret: ****

SSH Settings (for container console):
  Found matching SSH config:
    Host: pve
    User: admin
    Port: 2222
  Use this configuration? (Y/n): y

Configuration saved to ~/.config/proxmux/config.json
```

### Flow B: Multiple SSH Config Matches Found

```
SSH Settings (for container console):
  Found multiple matching SSH configs:
    1) pve (User: admin, Port: 2222)
    2) proxmox-prod (User: root, Port: 22)
  Select configuration (1-2), or press Enter to configure manually: 1

Configuration saved to ~/.config/proxmux/config.json
```

### Flow C: No SSH Config Match

```
SSH Settings (for container console):
  No matching SSH config found for 192.168.1.100
  SSH user (default: root): admin
  SSH port (default: 22): 2222

Configuration saved to ~/.config/proxmux/config.json
```

### Flow D: No ~/.ssh/config File

```
SSH Settings (for container console - press Enter for defaults):
  SSH user (default: root):
  SSH port (default: 22):

Configuration saved to ~/.config/proxmox/config.json
```

---

## 4. Technical Implementation

### 4.1 SSH Config Parser

#### Data Structure

```typescript
interface SSHConfigEntry {
  host: string;       // The Host alias (e.g., "pve")
  hostName?: string;  // HostName value (e.g., "192.168.1.100")
  user?: string;      // User value (e.g., "admin")
  port?: number;      // Port value (e.g., 2222)
}
```

#### Parser Logic

```typescript
function parseSSHConfig(configPath: string): SSHConfigEntry[]
```

1. Read file contents (return empty array if file doesn't exist)
2. Split into lines
3. Track current Host block
4. For each line:
   - Skip empty lines and comments (`#`)
   - If line starts with `Host `:
     - Save previous block (if any)
     - Start new block with the host alias
     - Skip if contains wildcards (`*`, `?`)
   - If line starts with `HostName `: store in current block
   - If line starts with `User `: store in current block
   - If line starts with `Port `: parse as integer, store in current block
5. Return array of parsed entries

#### Matching Logic

```typescript
function findMatchingSSHConfigs(
  entries: SSHConfigEntry[],
  targetHost: string
): SSHConfigEntry[]
```

Match entries where:
- `entry.hostName === targetHost` (HostName explicitly set), OR
- `entry.host === targetHost` (Host alias is the hostname itself)

Matching should be case-insensitive for hostnames.

### 4.2 File Locations

- **New file:** `src/utils/sshConfig.ts` - Parser and matching functions
- **Modified:** `src/index.tsx` - Onboarding flow integration

### 4.3 Integration with Onboarding

```typescript
// In --config flow, after getting Proxmox host:

const proxmoxHostname = new URL(host).hostname;
const sshConfigPath = join(homedir(), '.ssh', 'config');
const sshEntries = parseSSHConfig(sshConfigPath);
const matches = findMatchingSSHConfigs(sshEntries, proxmoxHostname);

if (matches.length === 1) {
  // Show single match, ask Y/n
} else if (matches.length > 1) {
  // Show numbered list, ask for selection
} else {
  // Fall back to manual entry
}
```

---

## 5. Test Cases

### 5.1 Parser Tests

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Basic entry | `Host pve\n  HostName 192.168.1.100\n  User admin` | `[{ host: "pve", hostName: "192.168.1.100", user: "admin" }]` |
| Entry with port | `Host pve\n  Port 2222` | `[{ host: "pve", port: 2222 }]` |
| Multiple entries | Two Host blocks | Array with both entries |
| Wildcard host | `Host *\n  User default` | `[]` (skipped) |
| Wildcard pattern | `Host *.internal` | `[]` (skipped) |
| Comments | `# comment\nHost pve` | Comment ignored, entry parsed |
| Empty lines | Interspersed empty lines | Handled correctly |
| Mixed indentation | Tabs and spaces | Both work |
| Case variations | `HOST`, `Host`, `host` | All recognized |
| No HostName | `Host myserver\n  User admin` | `[{ host: "myserver", user: "admin" }]` |
| Multiple hosts one line | `Host foo bar` | Entry with `host: "foo bar"` (or skip - TBD) |
| Malformed port | `Port notanumber` | Port field omitted or null |
| Empty file | `` | `[]` |
| File not found | N/A | `[]` (no error thrown) |
| Include directive | `Include ~/.ssh/config.d/*` | Line ignored |

### 5.2 Matching Tests

| Test Case | SSH Config | Target Host | Expected Matches |
|-----------|-----------|-------------|------------------|
| HostName match | `HostName 192.168.1.100` | `192.168.1.100` | 1 match |
| Host alias match | `Host 192.168.1.100` (no HostName) | `192.168.1.100` | 1 match |
| No match | `HostName 10.0.0.1` | `192.168.1.100` | 0 matches |
| Multiple matches | Two entries with same HostName | `192.168.1.100` | 2 matches |
| Case insensitive | `HostName Proxmox.Local` | `proxmox.local` | 1 match |
| IP vs hostname | `HostName 192.168.1.100` | `proxmox.local` | 0 matches |

### 5.3 Integration Tests

| Test Case | Setup | User Action | Expected Result |
|-----------|-------|-------------|-----------------|
| Accept single match | 1 matching entry | Press Enter (Y) | Config uses SSH entry |
| Decline single match | 1 matching entry | Type 'n' | Falls back to manual |
| Select from multiple | 2 matching entries | Type '1' | Uses first entry |
| Manual after multiple | 2 matching entries | Press Enter | Falls back to manual |
| No SSH config file | File doesn't exist | N/A | Manual entry flow |
| No matches | File exists, no match | N/A | Manual entry flow |
| Parse error | Malformed file | N/A | Manual entry flow (graceful) |

---

## 6. Edge Cases & Limitations

### Explicitly Not Supported

| Feature | Reason |
|---------|--------|
| `Include` directives | Requires recursive file loading, complex path resolution |
| `Match` blocks | Complex conditional logic, rare for this use case |
| Wildcards (`*`, `?`) | Ambiguous which config to use; explicit entries are clearer |
| `ProxyJump`/`ProxyCommand` | Not relevant for direct SSH to Proxmox |
| Token expansion (`%h`, `%u`) | Adds complexity, rarely used in HostName |

### Graceful Degradation

If any parsing error occurs, we:
1. Log nothing (silent failure)
2. Return empty array
3. Fall back to manual entry flow

Users with complex SSH configs can always manually enter their alias in the `sshHost` field.

---

## 7. Security Considerations

- **File permissions:** We only read `~/.ssh/config`, never write to it
- **No secrets:** SSH config typically doesn't contain secrets (keys are separate files)
- **No execution:** We parse text only, never execute SSH during detection
- **User confirmation:** Always ask before using detected settings

---

## 8. Future Enhancements

If user feedback indicates demand:

1. **Include directive support** - Follow Include paths to find more entries
2. **SSH connectivity test** - Optional "test connection" during setup
3. **Create SSH config entry** - Offer to add entry if none exists
4. **Identity file detection** - Show which key would be used

---

## 9. Implementation Checklist

- [ ] Create `src/utils/sshConfig.ts` with parser and matcher
- [ ] Add unit tests for parser (consider using Bun's test runner)
- [ ] Integrate detection into `src/index.tsx` onboarding flow
- [ ] Handle single match case (Y/n prompt)
- [ ] Handle multiple matches case (numbered selection)
- [ ] Handle no matches case (manual entry)
- [ ] Test on macOS and Linux
- [ ] Update documentation if needed

---

## 10. Open Questions

1. **Multiple hosts on one line:** `Host foo bar baz` - should we create separate entries for each, or treat as single entry?
   - *Recommendation:* Skip these for simplicity; they're uncommon.

2. **Display format:** When showing detected config, should we show all fields or just non-default ones?
   - *Recommendation:* Show User and Port only if they differ from defaults.

3. **Partial matches:** If SSH config has User but not Port, should we still ask about Port?
   - *Recommendation:* Yes, use detected values as defaults but still allow override.
