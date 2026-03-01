## GitHub Copilot Chat

- Extension Version: 0.28.5 (prod)
- VS Code: vscode/1.101.2
- OS: Mac

## Network

User Settings:
```json
  "github.copilot.advanced.debug.useElectronFetcher": true,
  "github.copilot.advanced.debug.useNodeFetcher": false,
  "github.copilot.advanced.debug.useNodeFetchFetcher": true
```

Connecting to https://api.github.com:
- DNS ipv4 Lookup: 140.82.112.6 (3 ms)
- DNS ipv6 Lookup: ::ffff:140.82.112.6 (4 ms)
- Proxy URL: None (1 ms)
- Electron fetch (configured): HTTP 200 (27 ms)
- Node.js https: HTTP 200 (183 ms)
- Node.js fetch: HTTP 200 (443 ms)
- Helix fetch: HTTP 200 (443 ms)

Connecting to https://api.githubcopilot.com/_ping:
- DNS ipv4 Lookup: 140.82.112.21 (16 ms)
- DNS ipv6 Lookup: ::ffff:140.82.112.21 (2 ms)
- Proxy URL: None (19 ms)
- Electron fetch (configured): HTTP 200 (91 ms)
- Node.js https: HTTP 200 (103 ms)
- Node.js fetch: HTTP 200 (104 ms)
- Helix fetch: HTTP 200 (120 ms)

## Documentation

In corporate networks: [Troubleshooting firewall settings for GitHub Copilot](https://docs.github.com/en/copilot/troubleshooting-github-copilot/troubleshooting-firewall-settings-for-github-copilot).