# Digital Asset Links (`assetlinks.json`)

Ties the domain `goatssportsapp.com` to the Android app `com.goats.app` so the
**Restore Credentials / zero-tap sign-in** WebAuthn flow works (relation
`delegate_permission/common.get_login_creds`).

Served automatically by Next.js from `public/` at:
`https://goatssportsapp.com/.well-known/assetlinks.json`

## Certs listed

Two SHA-256 certs (both registered in the Firebase project) are listed so that
Play-signed installs AND locally-built release APKs both validate:

- `21:18:71:5F:…:2F:0D` — Play App Signing cert (Play re-signs installs with this).
- `12:93:B4:8F:…:28:35` — upload key (local release builds from `keystore.jks`).

The matching `android:apk-key-hash:` values are in `EXPECTED_ORIGINS` in
`functions/src/index.ts` (Restore Credentials section).

### If zero-tap fails in the two-device test

Confirm which cert actually signs the installed app: Play Console → **Setup →
App Integrity → App signing key certificate** → SHA-256. It must match one of the
two above. If Play shows a different fingerprint, add it to both `assetlinks.json`
(here) and `EXPECTED_ORIGINS`, then redeploy web + functions.

### Serving requirement

`assetlinks.json` must return **HTTP 200 with no redirect** at exactly
`https://goatssportsapp.com/.well-known/assetlinks.json` (the RP ID host). If the
apex domain 301-redirects to `www`, make sure Vercel also serves the apex
directly, or set the WebAuthn `RP_ID` to the host that serves it without a
redirect (must stay consistent with `EXPECTED_ORIGINS` and the assetlinks host).
