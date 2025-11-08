#!/usr/bin/env node
/**
 * Check for Expo Router route conflicts.
 * 
 * Conflicts occur when both `app/<route>.tsx` and `app/<route>/index.tsx` exist,
 * as Expo Router cannot determine which one to use.
 * 
 * Usage: node scripts/check-routes.js
 * Exit code: 0 if no conflicts, 1 if conflicts found
 */

const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..', 'app');

if (!fs.existsSync(appDir)) {
  console.error('Error: app directory not found');
  process.exit(1);
}

// Get all .tsx files in app directory
const files = fs.readdirSync(appDir, { withFileTypes: true });

const conflicts = [];

for (const file of files) {
  if (file.isFile() && file.name.endsWith('.tsx') && !file.name.startsWith('_')) {
    const routeName = file.name.replace('.tsx', '');
    const folderPath = path.join(appDir, routeName);
    const indexPath = path.join(folderPath, 'index.tsx');
    
    // Check if both app/<route>.tsx and app/<route>/index.tsx exist
    if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
      if (fs.existsSync(indexPath)) {
        conflicts.push({
          singleFile: `app/${file.name}`,
          folderFile: `app/${routeName}/index.tsx`,
        });
      }
    }
  }
}

if (conflicts.length > 0) {
  console.error('❌ Route conflicts detected:\n');
  conflicts.forEach(({ singleFile, folderFile }) => {
    console.error(`  Conflict: ${singleFile} and ${folderFile} both exist`);
    console.error(`  Solution: Remove one of these files (prefer keeping ${folderFile})\n`);
  });
  process.exit(1);
} else {
  console.log('✅ No route conflicts found');
  process.exit(0);
}

