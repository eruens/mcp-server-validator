const core = require('@actions/core');
const glob = require('@actions/glob');
const fs = require('fs');
const path = require('path');

const SUPPORTED_TRANSPORTS = ['stdio', 'sse', 'streamable'];
const KNOWN_SERVER_FIELDS = ['command', 'args', 'env', 'type', 'url', 'disabled', 'description'];

async function run() {
  const configPath = core.getInput('config-path') || '**/.mcp.json';
  const strict = core.getInput('strict') === 'true';

  const globber = await glob.create(configPath, { followSymbolicLinks: false });
  const files = await globber.glob();

  if (files.length === 0) {
    core.warning(`No files matched "${configPath}"`);
    return;
  }

  core.info(`Validating ${files.length} MCP config file(s) (strict: ${strict})`);
  core.startGroup('Results');

  let hasErrors = false;
  let issueCount = 0;

  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    let config;

    try {
      config = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      hasErrors = true;
      core.error(`[${rel}] Invalid JSON: ${err.message}`);
      continue;
    }

    const errors = validateServers(config.mcpServers ?? config.servers, strict);

    if (errors.length === 0) {
      core.info(`[${rel}] OK`);
    } else {
      hasErrors = true;
      issueCount += errors.length;
      for (const e of errors) {
        const fn = e.severity === 'error' ? core.error : core.warning;
        fn(`[${rel}] ${e.severity === 'error' ? 'ERR' : 'WARN'} ${e.field}: ${e.message}`);
      }
    }
  }

  core.endGroup();

  if (hasErrors) {
    core.setFailed(`${issueCount} issue(s) found`);
  }
}

/** @param {unknown} servers */
function validateServers(servers, strict) {
  const issues = [];

  if (!servers) {
    issues.push({ severity: 'error', field: 'mcpServers', message: 'Property is missing' });
    return issues;
  }

  if (typeof servers !== 'object' || Array.isArray(servers)) {
    issues.push({ severity: 'error', field: 'mcpServers', message: 'Must be an object mapping names to configs' });
    return issues;
  }

  const names = Object.keys(servers);
  if (strict && names.length === 0) {
    issues.push({ severity: 'warning', field: 'mcpServers', message: 'No servers defined' });
  }

  for (const name of names) {
    const s = servers[name];

    if (typeof s !== 'object' || s === null) {
      issues.push({ severity: 'error', field: name, message: 'Server config must be an object' });
      continue;
    }

    if (typeof s.command !== 'string' && typeof s.url !== 'string') {
      issues.push({ severity: 'error', field: `${name}`, message: 'Requires "command" (string) or "url" (string)' });
    }

    if (s.type && !SUPPORTED_TRANSPORTS.includes(s.type)) {
      issues.push({ severity: 'error', field: `${name}.type`, message: `Unsupported transport "${s.type}". Use: ${SUPPORTED_TRANSPORTS.join(', ')}` });
    }

    if ('args' in s) {
      if (!Array.isArray(s.args)) {
        issues.push({ severity: 'error', field: `${name}.args`, message: 'Must be an array' });
      } else if (strict && s.args.some(a => typeof a !== 'string')) {
        issues.push({ severity: 'error', field: `${name}.args`, message: 'All elements must be strings' });
      }
    }

    if ('env' in s) {
      if (typeof s.env !== 'object' || s.env === null || Array.isArray(s.env)) {
        issues.push({ severity: 'error', field: `${name}.env`, message: 'Must be an object with string values' });
      } else if (strict) {
        for (const [k, v] of Object.entries(s.env)) {
          if (typeof v !== 'string') {
            issues.push({ severity: 'warning', field: `${name}.env.${k}`, message: `Expected string, got ${typeof v}` });
          }
        }
      }
    }

    if ('disabled' in s && typeof s.disabled !== 'boolean') {
      issues.push({ severity: 'warning', field: `${name}.disabled`, message: 'Must be a boolean' });
    }

    if (strict) {
      for (const key of Object.keys(s)) {
        if (!KNOWN_SERVER_FIELDS.includes(key)) {
          issues.push({ severity: 'warning', field: `${name}.${key}`, message: `Unknown field` });
        }
      }
    }
  }

  return issues;
}

run().catch(core.setFailed);