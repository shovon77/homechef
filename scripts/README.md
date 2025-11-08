# Pre-commit Scripts

## Check Merge Conflicts

The `check-merge-conflicts.js` script scans your codebase for Git merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) and prevents commits if any are found.

### Manual Usage

Run the script manually before committing:

```bash
node scripts/check-merge-conflicts.js
```

Or if you have npm scripts set up:

```bash
npm run precommit:check
```

### Setting up as a Git Hook (Optional)

To automatically run this before every commit:

1. **Using Husky** (if installed):
   ```bash
   npx husky add .husky/pre-commit "node scripts/check-merge-conflicts.js"
   ```

2. **Manual Git Hook**:
   ```bash
   # Create the hooks directory if it doesn't exist
   mkdir -p .git/hooks
   
   # Create the pre-commit hook
   cat > .git/hooks/pre-commit << 'EOF'
   #!/bin/sh
   node scripts/check-merge-conflicts.js
   EOF
   
   # Make it executable
   chmod +x .git/hooks/pre-commit
   ```

### What it checks

- Scans all `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.md`, `.yml`, `.yaml` files
- Ignores `node_modules`, `.git`, `.next`, `dist`, `build`, `.expo` directories
- Exits with code 1 if conflicts are found (blocking the commit)
- Exits with code 0 if no conflicts are found

### Exit Codes

- `0`: No merge conflict markers found ✅
- `1`: Merge conflict markers found ❌

