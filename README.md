# MCP Server Validator

Validate MCP server configuration files against the Model Context Protocol specification.

## Usage

```yaml
- uses: eruens/mcp-server-validator@v1
  with:
    config-path: '**/.mcp.json'
    strict: 'true'
```

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `config-path` | `**/.mcp.json` | Glob pattern for MCP config files |
| `strict` | `false` | Warnings become errors |

## Example

A valid `.mcp.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    },
    "api": {
      "url": "http://localhost:8080/mcp",
      "type": "sse"
    }
  }
}
```

## Development

```bash
npm install
npm test
```