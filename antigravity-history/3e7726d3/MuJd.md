# Resolving Port Locks and Stale Cache

If Next.js fails to start (`Unable to acquire lock`) or exhibits strange behavior locally:

1. **Kill Zombie Node Processes**:
   ```powershell
   taskkill /F /IM node.exe
   ```
2. **Clear Build Cache**:
   Delete the `.next` directory.
   ```powershell
   rmdir /s /q .next
   ```
3. **Restart**:
   Run `npm run dev` again.
