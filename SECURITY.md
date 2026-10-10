# Security Policy

## Supported Versions

rea-playbook is in active development. Only the latest released version receives security fixes.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you find a security issue in rea-playbook, please report it **privately** instead of opening a public issue:

- Use GitHub's **private vulnerability reporting**: open **Security → Report a vulnerability** on the repository, or
- If that is unavailable, open a regular issue and we will convert it to a private advisory.

rea-playbook itself ships **no** reverse-engineering engine. It calls the published `rea-agents` npm package at runtime; security issues that live in REA should be reported to the upstream project. Please do **not** paste REA source or any third-party proprietary code into reports.

### What to include

- A clear description of the impact and a minimal reproduction.
- The affected version (output of `npm run doctor` or `git describe --tags`).
- Whether the issue is in the offline preview (`npm run demo:offline`) or the real analysis path (`npm run analyze`).

### Response time

You can expect an initial response within **7 days**. Once triaged, we will coordinate a fix and, if needed, a coordinated disclosure date.
