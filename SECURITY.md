# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Octopus, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please send an email to **security@octopus.review** with:

- A description of the vulnerability
- Steps to reproduce the issue
- Any relevant logs or screenshots
- Your suggested fix (if any)

We will acknowledge your report within 48 hours and aim to provide a fix within 7 days for critical issues.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |

## Security Best Practices

When self-hosting Octopus, please ensure:

- All API keys and secrets are stored securely and never committed to version control
- The `.env` file is properly configured and excluded from git
- Database access is restricted to trusted networks
- HTTPS is enabled in production
- GitHub/Bitbucket webhook secrets are configured to verify payload authenticity
