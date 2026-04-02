# GitHub Pages (Privacidad)

## Publicar la politica
1. Confirma que el archivo existe en el repo: docs/privacy.html.
2. Haz commit y push a la rama principal (main o master).
3. En GitHub entra a Settings > Pages.
4. En **Build and deployment** selecciona:
   - **Source:** Deploy from a branch
   - **Branch:** la rama donde subiste los cambios (main o master)
   - **Folder:** /docs
5. Haz clic en **Save**.
6. Espera 1-3 minutos y refresca Settings > Pages hasta ver el check verde de publicacion.

## URL esperada
- Si el repositorio es 	orneosdetenis:
  - https://pitiin.github.io/torneosdetenis/privacy.html

## Si el enlace no abre
1. Verifica que el repositorio sea **public**.
2. Verifica que GitHub Pages este apuntando a la rama correcta.
3. Abre la URL base primero:
   - https://pitiin.github.io/torneosdetenis/
4. Si la base abre pero privacy.html no, revisa que el archivo se llame exactamente privacy.html (minusculas).
5. Si cambiaste usuario o nombre del repo, actualiza PRIVACY_POLICY_URL en pp/(tabs)/profile.tsx.