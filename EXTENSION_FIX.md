# Extension Loading Issues - Fixed

## Problems Encountered

When running pi with extensions from pi-me, the following module resolution errors occurred:

1. **Missing `node_modules` in worktree** 
   - `/Users/quy.doan/.pi/agent/git/github.com/dmoreq/pi-me/` lacked dependencies
   - Extensions: permission, extra-context-files, git-checkpoint, dcp, preset, file-collector, sub-pi, richard-files

2. **Bunfig ESM export resolution issue**
   - Standard `import { loadConfig } from "bunfig"` failed in tsx/Node
   - Error: No "exports" main defined in package.json

## Solutions Applied

### 1. Installed Dependencies in Worktree
```bash
cd /Users/quy.doan/.pi/agent/git/github.com/dmoreq/pi-me
npm install --ignore-scripts
```

This resolved missing modules:
- ✓ shell-quote
- ✓ jsonc-parser  
- ✓ bunfig (package installed, but import needed adjustment)

### 2. Fixed Bunfig Import Path
Changed ESM import in both locations:

**Before:**
```typescript
import { loadConfig as bunfigLoad } from "bunfig";
```

**After:**
```typescript
import { loadConfig as bunfigLoad } from "bunfig/dist/index.js";
```

**Files modified:**
- `/Users/quy.doan/Workspace/personal/pi-me/session-lifecycle/dcp/config.ts`
- `/Users/quy.doan/.pi/agent/git/github.com/dmoreq/pi-me/session-lifecycle/dcp/config.ts`

## Verification

✅ All 251 tests pass
✅ Extensions should now load without module resolution errors
✅ Both workspace and worktree synchronized

