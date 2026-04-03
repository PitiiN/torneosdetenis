# GitHub Pages (Privacidad)

## Publicar la politica
1. Confirma que existen `privacy.html` e `index.html` en la raiz del repo.
2. Haz commit y push a la rama principal (`main` o `master`).
3. En GitHub ve a **Settings > Pages**.
4. En **Build and deployment** selecciona:
   - **Source:** Deploy from a branch
   - **Branch:** `main` (o la rama donde hiciste push)
   - **Folder:** `/ (root)`
5. Guarda y espera 1-3 minutos.

## URL esperada
- Base: `https://pitiin.github.io/torneosdetenis/`
- Politica: `https://pitiin.github.io/torneosdetenis/privacy.html`

## Si no abre
1. Verifica que el repositorio sea publico.
2. Revisa en Pages que este publicada la ultima version.
3. Fuerza recarga del navegador (Ctrl+F5).
4. Confirma que `PRIVACY_POLICY_URL` en `app/(tabs)/profile.tsx` apunte a la URL de arriba.
