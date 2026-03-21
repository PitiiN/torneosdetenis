# Git Automation Workflow Pattern

Users often need a simple, single-command way to commit and push changes. Creating a custom agent workflow (stored in `.agent/workflows/`) provides a reliable interface for this.

## Implementation Pattern

The workflow should use sequential execution to ensure each step succeeds before the next, especially in PowerShell environments where command chaining (`&&`) may fail.

### Structure (`.agent/workflows/commit.md`)

```markdown
---
description: Subir código al repositorio de GitHub con un mensaje de commit personalizado
---

# Workflow: Commit y Push a GitHub

1. **Add all changes:**
   `& "C:\Program Files\Git\cmd\git.exe" add .`

2. **Commit with user message:**
   `& "C:\Program Files\Git\cmd\git.exe" commit -m "<MENSAJE_DEL_USUARIO>"`

3. **Push to primary branch:**
   `& "C:\Program Files\Git\cmd\git.exe" push origin main
```

## Usage
The user invokes it by name (e.g., `/commit`) followed by their message. The agent then executes the sequence using the provided message as the commit string.

## Technical Notes
- **PowerShell Compatibility**: Use the full path to `git.exe` if Git is not in the system path or if context switching occurs.
- **Error Handling**: Commands should be executed one-by-one to avoid parser errors with shell operators like `&&` in different Windows shells.
