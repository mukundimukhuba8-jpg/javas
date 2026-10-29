# Vercel — Oracle static deploy

The app is the committed Expo web export in **`public/`**.

## Dashboard (set once if GitHub auto-deploy fails)

1. Project → **Settings → General → Framework Preset** = **Other**
2. **Build & Development Settings** → override:
   - **Install Command**: empty, or `echo skip`
   - **Build Command**: empty, or `echo skip`
   - **Output Directory**: `public`
3. Clear any override that still runs root `pnpm run build` / monorepo builds.
4. **Deployment Protection**: for Production, disable SSO / Vercel Authentication if the public URL shows a Vercel login wall  
   (Settings → Deployment Protection → turn off for Production).

`vercel.json` already sets `installCommand`/`buildCommand` to null and `outputDirectory` to `public`.

## Working backup

https://mukundimukhuba8-jpg.github.io/javas/oracle/
