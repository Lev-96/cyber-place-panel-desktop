# Windows code signing

Both desktop installers (`cyber-place-panel-desktop` and
`cyber-place-panel-desktop-agent`) ship through GitHub Actions with a
**self-signed** Authenticode certificate. This document is the runbook for
issuing the cert, wiring it into CI, and rotating it.

## What signing does for us

| Concern | With self-signed | With EV cert | Unsigned |
|---|---|---|---|
| UAC dialog publisher | `Cyber Place` | `Cyber Place` | `Unknown Publisher` |
| SmartScreen on first launch | **Still warns** | Suppressed | Warns + flags |
| AV false-positive rate | Lower | Lowest | Highest |
| Cost | Free | ~$300/yr | — |

Self-signed gets us the named publisher in UAC and reduces some AV noise.
It does **not** silence SmartScreen — only an EV cert with reputation does.

## One-time setup

1. **Generate the cert locally.** From this repo root:

   ```bash
   bash scripts/generate-codesign-cert.sh
   ```

   You'll be prompted for a password. Save it — it becomes the
   `CSC_KEY_PASSWORD` secret. Outputs land in `./codesign-out/` (gitignored).

2. **Upload secrets to BOTH GitHub repos:**
   - `cyber-place-panel-desktop`
   - `cyber-place-panel-desktop-agent`

   In each: *Settings → Secrets and variables → Actions → New repository
   secret*

   | Secret name | Value |
   |---|---|
   | `CSC_LINK` | Full contents of `codesign-out/cyberplace-codesign.pfx.b64` |
   | `CSC_KEY_PASSWORD` | The password you typed in step 1 |

3. **Archive the `.pfx` securely** (1Password, encrypted USB). If lost,
   re-run the script — `verifyUpdateCodeSignature: false` in
   `electron-builder.json` means a new cert will not break updates for
   already-installed clients.

## How CI uses the secrets

`.github/workflows/release.yml` exposes the secrets as
`WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` to every matrix leg.
electron-builder picks them up only when the target is `--win`; the Linux
and macOS legs ignore them. If both secrets are absent, electron-builder
produces an unsigned installer — identical to the pre-signing behavior.

After packaging, a follow-up `Verify Windows signatures` step runs
`Get-AuthenticodeSignature` on every `.exe` under `release/`. If the
`CSC_LINK` secret is set but any file is unsigned or signed by a
different subject than `Cyber Place`, the job **fails the release** —
so a misconfigured cert never silently ships unsigned binaries. The
step is skipped on Linux/macOS legs and when no secret is set (unsigned
fallback still works).

## Rotation

Cert is valid for 10 years. To rotate sooner (e.g. private key exposure):

1. Re-run `scripts/generate-codesign-cert.sh`.
2. Replace `CSC_LINK` + `CSC_KEY_PASSWORD` in both repos' secrets.
3. Push a new tag — the next release ships signed by the new cert.

No client migration is needed.

## Verifying a signed installer

After a release, download the `.exe` from the GitHub Release and run
locally:

```bash
osslsigncode verify Cyberplace-Panel-Setup-1.0.x.exe
```

Expected: `Signature verification: ok` (the trust chain will say
`untrusted` — that's correct for a self-signed cert).

On Windows: right-click the `.exe` → *Properties → Digital Signatures*
should list `Cyber Place` as the signer.

## When antivirus / Defender / SmartScreen flag a release

Self-signed signing reduces but **does not eliminate** Windows warnings.
Here's what each warning means and how to address it.

### 1. SmartScreen blue screen ("Windows protected your PC")

This is *not* an AV — it's reputation-based. Microsoft tracks the
hash + signer combination across all installs; until enough installs
happen without incident, every new release shows this banner.

**Important truth about reputation:** SmartScreen reputation is
keyed on the signing certificate's *chain to a Microsoft Trusted Root
CA*. Self-signed certs do NOT chain to any trusted root, so they
accumulate **essentially zero reputation no matter how many installs
happen**. Earlier drafts of this doc suggested "dozens-to-hundreds of
installs" — that's only true for OV/EV CA-issued certs, not self-signed.

**What actually works:**
- User clicks *More info* → *Run anyway* every time. This does NOT
  build reputation for self-signed; it just dismisses the current
  install. Same warning will appear next install.
- The **only** real fixes:
  - **EV cert** (~$300/yr from Sectigo / DigiCert / SSL.com) →
    pre-trusted reputation, SmartScreen passes immediately from day 1.
  - **OV cert** (~$80/yr) → no immediate effect, but reputation accrues
    over thousands of installs (typically 3-6 months) and warning
    eventually stops appearing.
  - **Microsoft Store distribution** ($19 one-time, MSIX rebuild
    required) → no SmartScreen at all because Store apps are trusted.
- **Renaming the file, removing the version, hosting on different
  domains, etc. do not help.** SmartScreen keys on file hash + cert
  chain, not filename or URL.

There is no submission portal for SmartScreen — it's pure cert-chain +
usage signal.

### 2. Windows Defender real-time detection

This is a real AV verdict (e.g. `Trojan:Win32/Wacatac`,
`PUA:Win32/Presenoker`). Defender false-positives are common for new,
low-prevalence Electron installers — even signed ones.

**What works — Microsoft Security Intelligence submission:**

1. Open <https://www.microsoft.com/en-us/wdsi/filesubmission>
2. Sign in with a Microsoft account.
3. Upload the flagged `.exe` (the one from GitHub Release).
4. Choose **Software developer** → **Incorrect detection (false positive)**.
5. Paste:
   - **Detection name** from Defender (e.g. `Trojan:Win32/Wacatac.B!ml`)
   - **Filename** (e.g. `Cyberplace Panel Setup 1.0.19.exe`)
   - **Why this is a false positive**: brief description — that this is
     a self-signed legitimate desktop installer for an internal
     business product (gaming-venue management), signed with the
     `Cyber Place` certificate, distributed via the official GitHub
     Release at `github.com/Lev-96/...`.
6. Submit.

Turnaround is typically 24–72 hours. Once Microsoft re-classifies,
the warning disappears for every Defender install globally — without
re-releasing anything. Subsequent versions usually pass without
re-submission because the signer is now in Microsoft's "known good"
list for that publisher.

**Do this for every major release** until your signer accumulates enough
prevalence that Defender stops flagging new builds. Usually 2–3
submissions are enough.

### 3. Third-party AV (Kaspersky, ESET, Avast, Norton, etc.)

Each vendor has its own false-positive submission form. The most
common:

| Vendor | Submission URL |
|---|---|
| Kaspersky | <https://opentip.kaspersky.com/> |
| ESET | <https://support.eset.com/en/kb141> |
| Avast / AVG | <https://www.avast.com/false-positive-file-form.php> |
| Norton | <https://submit.norton.com/> |
| Bitdefender | <https://www.bitdefender.com/consumer/support/answer/29358/> |

Before submitting, scan the `.exe` on <https://www.virustotal.com> —
it shows which of ~70 AV engines flag the file. Submit only to the
ones that triggered.

### 4. "Improving the fingerprint"

Everything below is already in place in `electron-builder.json` /
`package.json` and contributes to lower heuristic scores. If you ever
touch them, keep them rich:

- `description` (package.json) → mapped to PE *FileDescription*
- `author` (package.json) → adds Comments field to PE
- `homepage` (package.json) → maps to PE *URL*
- `productName` → PE *ProductName*
- `publisherName` → PE *CompanyName*
- `legalTrademarks` → PE *LegalTrademarks*
- `copyright` → PE *LegalCopyright*
- `build/icon.ico` → PE icon resource
- Self-signed Authenticode signature with RFC3161 timestamp
- `signingHashAlgorithms: ["sha256"]`

The longer the version history with these fields stable and the same
signer, the lower the false-positive rate over time.

### 5. Per-release scan checklist (recommended)

After every CI release, run through this once:

1. Download the `.exe` from the new GitHub Release.
2. Upload to <https://www.virustotal.com> — note which engines flag.
3. For each flag, submit to that vendor's portal (Microsoft first).
4. Keep a small log per release of flagged engines, so you can see
   the false-positive rate trend downward over time.
