---
name: htrm
description: "Hyper Terminal Resource Manager - Manage and monitor system resources directly in the terminal. Use when: (1) monitoring CPU, memory, disk usage, (2) managing running processes, (3) checking network connections, (4) viewing system information, (5) analyzing resource trends, (6) killing processes. NOT for: GUI-based monitoring, complex visualization, or deep system diagnostics requiring specialized tools."
---

# Hyper Terminal Resource Manager (HTRM)

A command-line tool for monitoring and managing system resources in the terminal with real-time updates and interactive interface.

## Quick Start

```bash
# View all resources (CPU, Memory, Disk)
htrm

# View specific resource
htrm cpu
htrm mem
htrm disk
htrm net

# Interactive mode with process management
htrm top

# Check system info
htrm info
```

## Core Commands

### Resource Monitoring

| Command | Description | Output |
|---------|-------------|--------|
| `htrm` | Show all resources | CPU, Memory, Disk, Network summary |
| `htrm cpu` | CPU usage details | Per-core usage, temperature, frequency |
| `htrm mem` | Memory usage | Used/Free/Total, Swap usage |
| `htrm disk` | Disk I/O and usage | Per-mount point usage, read/write speeds |
| `htrm net` | Network statistics | Active connections, bandwidth usage |

### Process Management

| Command | Description |
|---------|-------------|
| `htrm ps` | List processes with resource usage |
| `htrm kill <pid>` | Terminate process by PID |
| `htrm top` | Interactive process viewer |
| `htrm tree` | Process tree visualization |

### System Information

| Command | Description |
|---------|-------------|
| `htrm info` | Basic system information |
| `htrm uptime` | System uptime and load averages |
| `htrm users` | Currently logged in users |
| `htrm ports` | List listening ports and connections |

## Interactive Mode

### htrm top
- Real-time updating process list (default 1s refresh)
- Sort by: CPU, Memory, PID, Name
- Actions: `k` kill, `s` stop, `r` resume
- Filters: `u` user, `p` priority, `t` terminal

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `q` | Quit |
| `r` | Refresh rate change |
| `c` | Toggle color mode |
| `h` | Help |
| `s` | Save current view to file |

## Options

```bash
htrm [command] [options]

Options:
  -n, --number <n>     Number of lines to display (default: 10)
  -s, --sort <field>   Sort field: cpu, mem, pid, name
  -c, --color          Force color output
  -j, --json           Output in JSON format
  -h, --help           Show help
  -v, --version        Show version
```

## Output Formats

### Default (Human-readable)
```
┌────────────────────────────────────────┐
│  HTRM - Hyper Terminal Resource Mgr   │
├────────────────────────────────────────┤
│  CPU:  ████████░░  78%                 │
│  MEM:  ██████░░░░  62% (8.2G/16G)      │
│  DISK: ███░░░░░░░  35% (/dev/sda1)    │
│  NET:  ↑ 1.2MB/s  ↓ 3.4MB/s           │
└────────────────────────────────────────┘
```

### JSON Output
```bash
htrm --json
# Returns structured data for scripting
```

## Use Cases

### 1. Quick System Check
```bash
htrm                    # See all resources at once
htrm --number 5        # Show top 5 processes
```

### 2. Monitor Specific Resource
```bash
watch htrm cpu         # Continuous CPU monitoring
htrm mem --json        # Parse memory data programmatically
```

### 3. Process Investigation
```bash
htrm ps --sort mem     # Find memory-hungry processes
htrm kill 1234         # Stop a problematic process
```

### 4. Network Debugging
```bash
htrm net               # Check network usage
htrm ports             # Find what's listening on ports
```

### 5. Scripting Integration
```bash
#!/bin/bash
# Alert if CPU is above 90%
CPU=$(htrm cpu --json | jq '.usage')
if (( $(echo "$CPU > 90" | bc -l) )); then
    echo "High CPU alert!"
fi
```

## Color Coding

| Level | Range | Color |
|-------|-------|-------|
| Normal | 0-60% | Green |
| Warning | 60-85% | Yellow |
| Critical | 85-100% | Red |

## Configuration

Create `~/.htrmrc` for custom settings:

```ini
[general]
refresh = 2           # Update interval in seconds
lines = 15            # Default number of lines
color = auto          # auto, always, never

[display]
theme = default       # default, minimal, compact
sort = cpu            # Default sort field
show_idle = false     # Hide idle processes

[alerts]
cpu_threshold = 90
mem_threshold = 85
disk_threshold = 95
```

## Dependencies

- **Required**: `node.js >= 14` or `python >= 3.6`
- **Optional**: `bc` (for decimal calculations in scripts)

## Installation

```bash
npm install -g htrm
# or
pip install htrm

# Verify
htrm --version
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No colors in output | Use `--color` flag or set `color = always` in config |
| Permission denied on kill | Use `sudo` for system processes |
| Slow refresh | Increase refresh interval with `-r` or in config |
| High CPU from htrm itself | Normal on busy systems, use `-n` to limit output |

---

**Remember**: `htrm` is for quick terminal checks. For deep diagnostics, use specialized tools like `htop`, `iotop`, or system monitoring daemons.
