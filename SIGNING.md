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
