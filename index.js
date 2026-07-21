const core = require('@actions/core');
const glob = require('@actions/glob');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const configPath = core.getInput('config-path') || '**/.mcp.json';
    const strict = core.getInput('strict') === 'true';
    const schemaVersion = core.getInput('schema-version') || '2025-03-26';

    const globber = await glob.create(configPath, { followSymbolicLinks: false });
    const files = await globber.glob();

    if (files.length === 0) {
      core.warning(`No MCP configuration files found matching "${configPath}"`);
      core.info('Expected file pattern: **/.mcp.json');
      return;
    }

    core.info(`MCP Validator (schema: ${schemaVersion}, strict: ${strict})`);
    core.info(`Found ${files.length} configuration file(s)`);
    core.startGroup('Validation results');

    let hasErrors = false;
    let totalIssues = 0;

    for (const file of files) {
      const relativePath = path.relative(process.cwd(), file);
      core.info(`\n?? ${relativePath}`);

      let config;
      try {
        const raw = fs.readFileSync(file, 'utf8');
        config = JSON.parse(raw);
      } catch (err) {
        hasErrors = true;
        core.error(`  ? Invalid JSON: ${err.message}`);
        continue;
      }

      const errors = validateConfig(config, file, strict, schemaVersion);

      if (errors.length === 0) {
        core.info(`  ? Valid`);
      } else {
        hasErrors = true;
        totalIssues += errors.length;
        for (const err of errors) {
          const level = err.severity === 'error' ? core.error : core.warning;
          level(`  ${err.severity === 'error' ? '?' : '??'} [${err.field}] ${err.message}`);
        }
      }
    }

    core.endGroup();

    if (hasErrors) {
      core.setFailed(`Validation complete - ${totalIssues} issue(s) found`);
    } else {
      core.info('? All MCP configurations are valid');
    }
  } catch (err) {
    core.setFailed(err.message);
  }
}

function validateConfig(config, filePath, strict, schemaVersion) {
  const issues = [];
  const servers = config.mcpServers || config.servers;

  if (!servers) {
    issues.push({ severity: 'error', field: 'root', message: 'Missing "mcpServers" or "servers" property' });
    return issues;
  }

  if (typeof servers !== 'object' || Array.isArray(servers)) {
    issues.push({ severity: 'error', field: 'mcpServers', message: 'Must be an object mapping server names to configurations' });
    return issues;
  }

  const names = Object.keys(servers);
  if (names.length === 0 && strict) {
    issues.push({ severity: 'warning', field: 'mcpServers', message: 'No servers defined (strict mode)' });
  }

  for (const name of names) {
    const server = servers[name];

    if (typeof server !== 'object' || server === null) {
      issues.push({ severity: 'error', field: name, message: 'Server configuration must be an object' });
      continue;
    }

    // Check command or url (one is required)
    const hasCommand = server.command && typeof server.command === 'string';
    const hasUrl = server.url && typeof server.url === 'string';

    if (!hasCommand && !hasUrl) {
      issues.push({ severity: 'error', field: `${name}.command`, message: 'Missing required field: "command" (string) or "url" (string)' });
    }

    // Validate transport type
    const validTransports = ['stdio', 'sse', 'streamable'];
    if (server.type && !validTransports.includes(server.type)) {
      issues.push({ severity: 'error', field: `${name}.type`, message: `Invalid transport "${server.type}". Valid: ${validTransports.join(', ')}` });
    }

    // Infer transport type from URL
    if (hasUrl && !server.type) {
      server.type = server.url.startsWith('http') ? 'sse' : 'stdio';
    }

    // args must be array of strings
    if ('args' in server) {
      if (!Array.isArray(server.args)) {
        issues.push({ severity: 'error', field: `${name}.args`, message: 'Must be an array of strings' });
      } else if (strict && server.args.some(a => typeof a !== 'string')) {
        issues.push({ severity: 'error', field: `${name}.args`, message: 'All arguments must be strings (strict mode)' });
      }
    }

    // env must be object of strings
    if ('env' in server) {
      if (typeof server.env !== 'object' || server.env === null || Array.isArray(server.env)) {
        issues.push({ severity: 'error', field: `${name}.env`, message: 'Must be an object with string key-value pairs' });
      } else if (strict) {
        for (const [key, val] of Object.entries(server.env)) {
          if (typeof val !== 'string') {
            issues.push({ severity: 'warning', field: `${name}.env.${key}`, message: `Expected string, got ${typeof val}` });
          }
        }
      }
    }

    // Check for unknown/typo'd fields
    const knownFields = ['command', 'args', 'env', 'type', 'url', 'disabled', 'description', 'transport', 'name'];
    if (strict) {
      for (const key of Object.keys(server)) {
        if (!knownFields.includes(key)) {
          issues.push({ severity: 'warning', field: `${name}.${key}`, message: `Unknown field "${key}"` });
        }
      }
    }

    // disabled must be boolean
    if ('disabled' in server && typeof server.disabled !== 'boolean') {
      issues.push({ severity: 'warning', field: `${name}.disabled`, message: 'Expected boolean' });
    }
  }

  return issues;
}

// Add MCP schema reference
const MCP_SCHEMA = {
  '2024-11-05': { /* initial spec */ },
  '2025-03-26': { /* latest spec with streamable HTTP */ }
};

run();