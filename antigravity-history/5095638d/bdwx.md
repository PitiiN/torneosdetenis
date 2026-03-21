---
description: Subir código al repositorio de GitHub con un mensaje de commit personalizado
---

# Workflow: Commit y Push a GitHub

Este workflow sube todos los cambios al repositorio de GitHub.

## Requisitos
- El usuario debe proporcionar un mensaje de commit descriptivo.

## Pasos

// turbo-all

1. **Agregar todos los archivos modificados al staging:**
```powershell
& "C:\Program Files\Git\cmd\git.exe" add .
```

2. **Crear el commit con el mensaje proporcionado por el usuario:**
```powershell
& "C:\Program Files\Git\cmd\git.exe" commit -m "<MENSAJE_DEL_USUARIO>"
```
> ⚠️ Reemplaza `<MENSAJE_DEL_USUARIO>` con el mensaje que el usuario proporcionó al invocar este workflow.

3. **Subir los cambios a GitHub (rama main):**
```powershell
& "C:\Program Files\Git\cmd\git.exe" push origin main
```

4. **Confirmar al usuario que el código fue subido exitosamente.**

## Notas
- Si el push falla por autenticación, el usuario debe ejecutar el comando manualmente o configurar sus credenciales de Git.
- El directorio de trabajo debe ser: `c:\Users\Asus\OneDrive - CORPORACIÓN XIX JUEGOS PANAMERICANOS SANTIAGO 2023\Escritorio\PitiN\Antigravity\ArriendoCanchas`
