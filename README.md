# MCP Server Validator

A GitHub Action that validates MCP (Model Context Protocol) server configuration files against the spec - catching misconfigurations before they cause runtime failures.

## Features

- ? **Full schema validation** - checks required fields, types, transport modes
- ? **Multiple file support** - validate all `.mcp.json` files in your repo
- ? **Strict mode** - catches unknown fields, type mismatches, missing optional fields
- ? **Detailed reporting** - per-file results with field-level errors
- ? **CI-native** - fails your workflow when configs are invalid

## Usage

```yaml
name: Validate MCP Configs
on:
  push:
    paths:
      - '**.mcp.json'
  pull_request:
    paths:
      - '**.mcp.json'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: eruens/mcp-server-validator@v1
        with:
          config-path: '**/.mcp.json'
          strict: 'true'
```

### Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `config-path` | `**/.mcp.json` | Glob pattern(s) for MCP config files |
| `strict` | `false` | Warnings become errors; catches unknown fields and type mismatches |
| `schema-version` | `2025-03-26` | MCP spec version to validate against |

## Example Config

A valid `.mcp.json` file:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "env": {
        "NODE_ENV": "production"
      }
    },
    "database": {
      "url": "http://localhost:8080/mcp",
      "type": "sse"
    }
  }
}
```

## Local Development

```bash
npm install
npm test
```

## Publishing to Marketplace

Create a release with a `v1` tag - the action auto-publishes.