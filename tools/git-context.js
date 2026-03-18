#!/usr/bin/env node

/**
 * git-context — Git-native context management for AI-assisted development.
 *
 * Stores structured reasoning notes in .git/COMMIT_CONTEXT/<hash>.md,
 * keyed by commit hash. Local-only, never pushed to remote.
 *
 * Usage:
 *   node tools/git-context.js write [hash]           Write/overwrite context for a commit (default: HEAD)
 *   node tools/git-context.js write [hash] --stdin    Read context body from stdin
 *   node tools/git-context.js read  [hash]            Read context for a commit (default: HEAD)
 *   node tools/git-context.js log   [n]               Show last n commits with context (default: 10)
 *   node tools/git-context.js trail [base]            Show context trail for current branch since base (default: main/master)
 *   node tools/git-context.js init                    Install post-commit hook
 *   node tools/git-context.js has   [hash]            Exit 0 if context exists, 1 if not
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: 'utf-8' }).trim();
}

function getGitDir() {
  return git('rev-parse --git-dir');
}

function contextDir() {
  const dir = join(getGitDir(), 'COMMIT_CONTEXT');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function contextPath(hash) {
  return join(contextDir(), `${hash}.md`);
}

function resolveHash(ref = 'HEAD') {
  return git(`rev-parse ${ref}`);
}

function shortHash(hash) {
  return hash.slice(0, 7);
}

function commitOneliner(hash) {
  return git(`log -1 --format="%h %s" ${hash}`);
}

function commitMessage(hash) {
  return git(`log -1 --format="%s" ${hash}`);
}

function hasContext(hash) {
  return existsSync(contextPath(hash));
}

function readContext(hash) {
  const p = contextPath(hash);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf-8');
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdWrite(ref, useStdin) {
  const hash = resolveHash(ref);
  const msg = commitMessage(hash);
  const path = contextPath(hash);
  const exists = existsSync(path);

  if (useStdin) {
    // Read context body from stdin (for programmatic/AI use)
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString('utf-8').trim();

    const header = `# Context for ${shortHash(hash)}: ${msg}\n\n`;
    writeFileSync(path, header + body + '\n', 'utf-8');
    console.log(`${exists ? 'Updated' : 'Wrote'} context for ${shortHash(hash)}`);
    return;
  }

  // Interactive: open template in $EDITOR or prompt line-by-line
  const editor = process.env.EDITOR || process.env.VISUAL;

  if (editor) {
    // Write template if new
    if (!exists) {
      const template = [
        `# Context for ${shortHash(hash)}: ${msg}`,
        '',
        '## Reasoning',
        '',
        '',
        '## Rejected Approaches',
        '',
        '- ',
        '',
        '## Non-Obvious Decisions',
        '',
        '- ',
        '',
        '## Next Steps',
        '',
        '',
      ].join('\n');
      writeFileSync(path, template, 'utf-8');
    }
    execSync(`${editor} "${path}"`, { stdio: 'inherit' });
    console.log(`Context saved for ${shortHash(hash)}`);
  } else {
    // No editor: simple line-by-line prompt
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise((res) => rl.question(q, res));

    const reasoning = await ask('Reasoning: ');
    const rejected = await ask('Rejected approaches (comma-separated): ');
    const decisions = await ask('Non-obvious decisions (comma-separated): ');
    const nextSteps = await ask('Next steps: ');
    rl.close();

    const lines = [`# Context for ${shortHash(hash)}: ${msg}`, ''];
    if (reasoning) lines.push('## Reasoning', '', reasoning, '');
    if (rejected) {
      lines.push('## Rejected Approaches', '');
      rejected.split(',').forEach((r) => lines.push(`- ${r.trim()}`));
      lines.push('');
    }
    if (decisions) {
      lines.push('## Non-Obvious Decisions', '');
      decisions.split(',').forEach((d) => lines.push(`- ${d.trim()}`));
      lines.push('');
    }
    if (nextSteps) lines.push('## Next Steps', '', nextSteps, '');

    writeFileSync(path, lines.join('\n'), 'utf-8');
    console.log(`Context saved for ${shortHash(hash)}`);
  }
}

function cmdRead(ref) {
  const hash = resolveHash(ref);
  const ctx = readContext(hash);
  if (ctx) {
    console.log(ctx);
  } else {
    console.log(`No context for ${commitOneliner(hash)}`);
    process.exitCode = 1;
  }
}

function cmdLog(count) {
  const hashes = git(`log -${count} --format="%H"`).split('\n').filter(Boolean);

  for (const hash of hashes) {
    const oneliner = commitOneliner(hash);
    const ctx = readContext(hash);
    if (ctx) {
      console.log(`\x1b[32m●\x1b[0m ${oneliner}`);
      // Print context body indented, skip the header line
      const body = ctx
        .split('\n')
        .slice(1)
        .map((l) => `    ${l}`)
        .join('\n')
        .trim();
      if (body) console.log(`    ${body}`);
      console.log();
    } else {
      console.log(`\x1b[90m○ ${oneliner}\x1b[0m`);
    }
  }
}

function cmdTrail(base) {
  // Find the merge base
  let mergeBase;
  try {
    mergeBase = git(`merge-base ${base} HEAD`);
  } catch {
    console.error(`Could not find merge base with '${base}'. Try: git-context trail main`);
    process.exitCode = 1;
    return;
  }

  const hashes = git(`log ${mergeBase}..HEAD --format="%H"`)
    .split('\n')
    .filter(Boolean);

  if (hashes.length === 0) {
    console.log('No commits since divergence from', base);
    return;
  }

  console.log(`Context trail: ${hashes.length} commits since ${base}\n`);
  for (const hash of hashes.reverse()) {
    const oneliner = commitOneliner(hash);
    const ctx = readContext(hash);
    if (ctx) {
      console.log(`\x1b[32m●\x1b[0m ${oneliner}`);
      const body = ctx
        .split('\n')
        .slice(1)
        .map((l) => `    ${l}`)
        .join('\n')
        .trim();
      if (body) console.log(`    ${body}`);
      console.log();
    } else {
      console.log(`\x1b[90m○ ${oneliner}\x1b[0m`);
    }
  }
}

function cmdInit() {
  const hooksDir = join(getGitDir(), 'hooks');
  if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });

  const hookPath = join(hooksDir, 'post-commit');
  const hookLine = '\n# git-context: remind to write context\necho "\\033[33m💡 Write commit context: node tools/git-context.js write\\033[0m"\n';

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf-8');
    if (existing.includes('git-context')) {
      console.log('post-commit hook already includes git-context reminder.');
      return;
    }
    appendFileSync(hookPath, hookLine, 'utf-8');
  } else {
    writeFileSync(hookPath, '#!/bin/sh\n' + hookLine, { mode: 0o755 });
  }

  console.log('Installed post-commit hook.');
}

function cmdHas(ref) {
  const hash = resolveHash(ref);
  process.exitCode = hasContext(hash) ? 0 : 1;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'write':
    await cmdWrite(args[1] || 'HEAD', args.includes('--stdin'));
    break;
  case 'read':
    cmdRead(args[1] || 'HEAD');
    break;
  case 'log':
    cmdLog(parseInt(args[1], 10) || 10);
    break;
  case 'trail':
    cmdTrail(args[1] || 'main');
    break;
  case 'init':
    cmdInit();
    break;
  case 'has':
    cmdHas(args[1] || 'HEAD');
    break;
  default:
    console.log(`git-context — Git-native context management for AI-assisted development

Usage:
  write [hash]            Write context for a commit (default: HEAD)
  write [hash] --stdin    Pipe context body from stdin
  read  [hash]            Read context for a commit (default: HEAD)
  log   [n]               Show last n commits with context (default: 10)
  trail [base]            Context trail since branch divergence (default: main)
  init                    Install post-commit hook reminder
  has   [hash]            Exit 0 if context exists, 1 if not

Context is stored in .git/COMMIT_CONTEXT/<hash>.md (local-only, never pushed).`);
    break;
}
