# SOP: Commit Signing Setup and Verification

**Version**: 1.0 **Sprint**: SPRINT-REPO-TRUTH-LOCK-001 **Date**: 2026-02-27
**Status**: ENFORCED

---

## Overview

All commits to this repository MUST be cryptographically signed and verified.
This SOP documents the setup, verification, and troubleshooting procedures for
commit signing using SSH keys (preferred method on Windows/macOS/Linux).

---

## Quick Setup (SSH Signing)

### 1. Prerequisites

- Git 2.34+ (SSH signing support)
- SSH key pair (Ed25519 recommended)
- GitHub account with SSH key added as **signing key**

### 2. Configure Git

```bash
# Set signing format to SSH
git config --global gpg.format ssh

# Set your signing key (path to public key)
git config --global user.signingkey ~/.ssh/id_ed25519.pub

# Enable signing by default
git config --global commit.gpgsign true
git config --global tag.gpgsign true

# Create allowed_signers file for local verification
echo "<your-email> $(cat ~/.ssh/id_ed25519.pub)" > ~/.ssh/allowed_signers
git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers
```

### 3. Add Key to GitHub

1. Go to GitHub Settings > SSH and GPG keys
2. Click "New SSH key"
3. Select "Signing key" as key type
4. Paste your public key
5. Save

Or via CLI:

```bash
gh auth refresh -h github.com -s admin:ssh_signing_key
gh ssh-key add ~/.ssh/id_ed25519.pub --type signing --title "your-key-name"
```

---

## Verification Commands

### Verify Signing is Enabled

```bash
git config --global --list | grep -E "(gpg|sign)"
# Expected:
# commit.gpgsign=true
# tag.gpgsign=true
# gpg.format=ssh
# user.signingkey=/path/to/key.pub
# gpg.ssh.allowedsignersfile=/path/to/allowed_signers
```

### Verify a Commit Signature

```bash
# Show signature on specific commit
git show --show-signature HEAD

# Verify recent commits
git log --show-signature -3

# Check if commit is signed (returns 0 if signed)
git verify-commit HEAD
```

### Verify a Tag Signature

```bash
git tag -v <tag-name>
```

---

## Troubleshooting

### Error: "error: gpg failed to sign the data"

**Cause**: SSH agent not running or key not loaded.

**Fix** (Windows):

```bash
# Start ssh-agent
eval "$(ssh-agent -s)"

# Add your key
ssh-add ~/.ssh/id_ed25519
```

### Error: "No secret key" or "signing failed"

**Cause**: Incorrect signing key path.

**Fix**:

```bash
# Verify key exists
ls -la ~/.ssh/id_ed25519.pub

# Reset signing key path
git config --global user.signingkey ~/.ssh/id_ed25519.pub
```

### Commits Show "Unverified" on GitHub

**Cause**: SSH key not added as signing key (only as authentication key).

**Fix**:

1. Go to GitHub Settings > SSH and GPG keys
2. Ensure the key is listed under "Signing keys" (not just "Authentication
   keys")
3. If missing, add it with type "Signing key"

### Error: "could not find principal"

**Cause**: Email mismatch or missing allowed_signers entry.

**Fix**:

```bash
# Verify your Git email matches allowed_signers
git config user.email

# Update allowed_signers if needed
echo "your-email@example.com $(cat ~/.ssh/id_ed25519.pub)" > ~/.ssh/allowed_signers
```

---

## Windows-Specific Notes

### Using Git Bash

SSH signing works out-of-box with Git Bash if:

- OpenSSH is installed (comes with Git for Windows)
- SSH key exists at `~/.ssh/id_ed25519`

### Using Windows OpenSSH

If using Windows native OpenSSH:

```bash
git config --global core.sshCommand "C:/Windows/System32/OpenSSH/ssh.exe"
```

---

## Enforcement Rules

1. **All commits to `main` MUST be signed and verified**
2. **Branch protection enforces verified signatures**
3. **CI/CD will reject unsigned commits**
4. **Tags minted by CI are automatically signed**

---

## Compliance Checklist

- [ ] SSH key generated (Ed25519)
- [ ] Git config has `commit.gpgsign=true`
- [ ] Git config has `gpg.format=ssh`
- [ ] Git config has `user.signingkey` set
- [ ] SSH key added to GitHub as **signing key**
- [ ] Test commit shows "Verified" on GitHub

---

## References

- [GitHub: Signing commits with SSH](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)
- [Git documentation: git-config](https://git-scm.com/docs/git-config#Documentation/git-config.txt-gpgformat)

---

**Document Owner**: Engineering Team **Last Updated**: 2026-02-27
