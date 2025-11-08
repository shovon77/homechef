#!/usr/bin/env node

/**
 * Pre-commit hook to check for Git merge conflict markers
 * Usage: node scripts/check-merge-conflicts.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFLICT_MARKERS = ['<<<<<<<', '=======', '>>>>>>>'];
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.expo',
];

function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const issues = [];

    lines.forEach((line, index) => {
      CONFLICT_MARKERS.forEach(marker => {
        // Only match markers at the start of a line (with optional whitespace)
        // This avoids false positives in strings or comments
        if (line.trim().startsWith(marker)) {
          issues.push({
            file: filePath,
            line: index + 1,
            marker,
            content: line.trim(),
          });
        }
      });
    });

    return issues;
  } catch (error) {
    // Skip files that can't be read (binary, permissions, etc.)
    return [];
  }
}

function findSourceFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!shouldIgnore(filePath)) {
        findSourceFiles(filePath, fileList);
      }
    } else if (stat.isFile()) {
      if (!shouldIgnore(filePath)) {
        // Check common source file extensions
        const ext = path.extname(file);
        if (['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yml', '.yaml'].includes(ext)) {
          fileList.push(filePath);
        }
      }
    }
  });

  return fileList;
}

function main() {
  console.log('🔍 Checking for merge conflict markers...\n');

  const rootDir = path.resolve(__dirname, '..');
  const sourceFiles = findSourceFiles(rootDir);
  const allIssues = [];

  sourceFiles.forEach(file => {
    const issues = checkFile(file);
    if (issues.length > 0) {
      allIssues.push(...issues);
    }
  });

  if (allIssues.length > 0) {
    console.error('❌ Found merge conflict markers!\n');
    allIssues.forEach(issue => {
      console.error(`  ${issue.file}:${issue.line}`);
      console.error(`    ${issue.marker} - ${issue.content.substring(0, 60)}...`);
    });
    console.error('\n⚠️  Please resolve all merge conflicts before committing.');
    console.error('   Look for <<<<<<<, =======, and >>>>>>> markers in the files above.\n');
    process.exit(1);
  } else {
    console.log('✅ No merge conflict markers found.\n');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkFile, findSourceFiles };

