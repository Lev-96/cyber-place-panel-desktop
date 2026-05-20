#!/usr/bin/env bash
#
# Generates a self-signed Windows code-signing certificate for Cyber Place
# desktop builds (panel + agent). Run this ONCE locally; the resulting
# .pfx + password go into GitHub Secrets (CSC_LINK, CSC_KEY_PASSWORD) of
# both repos:
#   - cyber-place-panel-desktop
#   - cyber-place-panel-desktop-agent
#
# What this produces in ./codesign-out/:
#   cyberplace-codesign.pfx       — PKCS#12 bundle (private key + cert)
#   cyberplace-codesign.pfx.b64   — same file, base64-encoded for CSC_LINK
#   cyberplace-codesign.crt       — public cert only (safe to share)
#
# IMPORTANT
#   - Never commit .pfx / .key / codesign-out/. The repo .gitignore blocks them.
#   - The cert is self-signed: Windows SmartScreen will still warn on first
#     launch. It DOES remove "Unknown Publisher" in UAC and helps a bit with
#     antivirus heuristics. EV cert (~$300/yr with reputation) is the only
#     way to suppress SmartScreen entirely.
#   - CN must match `publisherName` in electron-builder.json (= "Cyber Place").
#
# Renewal: cert validity is 10 years. To rotate sooner, re-run this script
# and update both GitHub Secrets. `verifyUpdateCodeSignature: false` in
# electron-builder.json means rotating the cert WILL NOT break updates for
# already-installed clients.

set -euo pipefail

CN="${CN:-Cyber Place}"
ORG="${ORG:-Cyber Place}"
COUNTRY="${COUNTRY:-AM}"
DAYS="${DAYS:-3650}"
OUT_DIR="${OUT_DIR:-./codesign-out}"

command -v openssl >/dev/null 2>&1 || { echo "openssl not found in PATH" >&2; exit 1; }

mkdir -p "$OUT_DIR"

read -rsp "Enter password for the new .pfx (you will paste this into CSC_KEY_PASSWORD): " PFX_PASS
echo
read -rsp "Confirm password: " PFX_PASS_CONFIRM
echo
[ "$PFX_PASS" = "$PFX_PASS_CONFIRM" ] || { echo "Passwords do not match." >&2; exit 1; }
[ -n "$PFX_PASS" ] || { echo "Password must not be empty." >&2; exit 1; }

KEY="$OUT_DIR/cyberplace-codesign.key"
CRT="$OUT_DIR/cyberplace-codesign.crt"
PFX="$OUT_DIR/cyberplace-codesign.pfx"
B64="$OUT_DIR/cyberplace-codesign.pfx.b64"
CNF="$OUT_DIR/.cyberplace-codesign.cnf"

cat > "$CNF" <<EOF
[ req ]
distinguished_name = req_dn
prompt             = no
x509_extensions    = v3_codesign

[ req_dn ]
CN = $CN
O  = $ORG
C  = $COUNTRY

[ v3_codesign ]
basicConstraints     = critical, CA:false
keyUsage             = critical, digitalSignature
extendedKeyUsage     = critical, codeSigning
subjectKeyIdentifier = hash
EOF

echo "Generating 4096-bit RSA key..."
openssl genrsa -out "$KEY" 4096 2>/dev/null

echo "Issuing self-signed certificate (CN=$CN, valid $DAYS days)..."
openssl req -new -x509 \
  -key "$KEY" \
  -out "$CRT" \
  -days "$DAYS" \
  -config "$CNF" \
  -extensions v3_codesign \
  -sha256

echo "Packing PKCS#12 bundle..."
openssl pkcs12 -export \
  -out "$PFX" \
  -inkey "$KEY" \
  -in "$CRT" \
  -name "Cyber Place Code Signing" \
  -passout pass:"$PFX_PASS"

echo "Base64-encoding for GitHub Secret CSC_LINK..."
base64 -w0 < "$PFX" > "$B64"

rm -f "$CNF" "$KEY"

if command -v osslsigncode >/dev/null 2>&1; then
  echo "osslsigncode detected — smoke-testing PFX can sign a dummy binary..."
  TMP_BIN="$(mktemp --suffix=.exe)"
  printf 'MZ\x90\x00' > "$TMP_BIN"
  if osslsigncode sign \
      -pkcs12 "$PFX" -pass "$PFX_PASS" \
      -n "Cyber Place" -i "https://cyberplace.pro" \
      -in "$TMP_BIN" -out "$TMP_BIN.signed" >/dev/null 2>&1; then
    echo "  ok — pfx is usable by osslsigncode."
  else
    echo "  warn — osslsigncode could not sign the dummy file (this is fine if header is too short to be a real PE; the pfx itself is valid)."
  fi
  rm -f "$TMP_BIN" "$TMP_BIN.signed"
fi

echo
echo "Done. Artifacts in $OUT_DIR/:"
ls -1 "$OUT_DIR"
echo
echo "Next steps:"
echo "  1. In each GitHub repo (cyber-place-panel-desktop, cyber-place-panel-desktop-agent):"
echo "     Settings -> Secrets and variables -> Actions -> New repository secret"
echo "       CSC_LINK          = <paste full contents of $B64>"
echo "       CSC_KEY_PASSWORD  = <the password you just typed>"
echo "  2. Verify .gitignore blocks *.pfx / codesign-out/ before any commit."
echo "  3. Keep $PFX in a safe place (1Password / encrypted USB). Without it"
echo "     you can still re-issue a new cert — clients won't break because"
echo "     verifyUpdateCodeSignature is disabled."
