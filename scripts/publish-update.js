const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const readline = require('readline');

// Paths
const projectRoot = path.resolve(__dirname, '..');
const envProdPath = path.join(projectRoot, '.env.production');

function log(msg) {
  console.log(`[Publish Update] ${msg}`);
}

function error(msg) {
  console.error(`\x1b[31m[Error] ${msg}\x1b[0m`);
  process.exit(1);
}

// 1. Verify .env.production exists
if (!fs.existsSync(envProdPath)) {
  error('No se encontró el archivo .env.production en la raíz del proyecto. Por favor créalo con las credenciales de producción.');
}

// 2. Parse .env.production
const envContent = fs.readFileSync(envProdPath, 'utf8');
const envVars = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*EXPO_PUBLIC_([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (match) {
    envVars[`EXPO_PUBLIC_${match[1]}`] = match[2].replace(/['"]/g, '').trim();
  }
});

const supabaseUrl = envVars['EXPO_PUBLIC_SUPABASE_URL'];
const supabaseAnonKey = envVars['EXPO_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseAnonKey) {
  error('El archivo .env.production debe contener EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

// Strip trailing slash or rest/v1 from URL if present
let cleanUrl = supabaseUrl.trim();
if (cleanUrl.endsWith('/')) {
  cleanUrl = cleanUrl.slice(0, -1);
}
if (cleanUrl.endsWith('/rest/v1')) {
  cleanUrl = cleanUrl.slice(0, -8);
}
envVars['EXPO_PUBLIC_SUPABASE_URL'] = cleanUrl;

// 3. Get update message
let message = process.argv.slice(2).join(' ').trim();

if (message) {
  proceedWithPublish(message);
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('\x1b[36mIngresa el mensaje para la actualización OTA (ej: "Correccion de diseno"): \x1b[0m', (answer) => {
    rl.close();
    const msg = answer.trim();
    if (!msg) {
      error('El mensaje de la actualización es obligatorio.');
    }
    proceedWithPublish(msg);
  });
}

function proceedWithPublish(updateMessage) {
  log('Iniciando proceso de publicación limpia...');
  log(`Base de datos de producción: ${envVars['EXPO_PUBLIC_SUPABASE_URL']}`);
  log(`Mensaje: "${updateMessage}"`);

  // 4. Clean caches
  log('Limpiando cachés locales y globales...');
  
  const pathsToClean = [
    path.join(projectRoot, '.expo'),
    path.join(projectRoot, 'dist'),
    path.join(os.tmpdir(), 'metro-cache'),
  ];

  pathsToClean.forEach(p => {
    try {
      if (fs.existsSync(p)) {
        log(`Eliminando: ${p}`);
        fs.rmSync(p, { recursive: true, force: true });
      }
    } catch (e) {
      log(`Advertencia al eliminar ${p}: ${e.message}`);
    }
  });

  // Clean haste-map files in OS temp
  try {
    const tempDir = os.tmpdir();
    const files = fs.readdirSync(tempDir);
    files.forEach(file => {
      if (file.startsWith('haste-map-') || file.startsWith('metro-')) {
        const fullPath = path.join(tempDir, file);
        try {
          if (fs.statSync(fullPath).isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(fullPath);
          }
        } catch (err) {
          // ignore lock/permission errors on individual temp files
        }
      }
    });
    log('Caché global de haste-map y metro en Temp limpiados.');
  } catch (e) {
    log(`Advertencia al limpiar archivos temporales de haste-map: ${e.message}`);
  }

  // 5. Run eas update
  log('Compilando y subiendo actualización a EAS (esto tomará un par de minutos)...');
  
  const env = {
    ...process.env,
    ...envVars,
    NODE_TLS_REJECT_UNAUTHORIZED: '0',
    EAS_NO_CACHE: '1'
  };

  const command = 'npx';
  const args = ['eas', 'update', '--branch', 'production', '--message', updateMessage];

  // Spawn the child process and inherit stdio so it shows the native interactive CLI output
  const result = spawnSync(command, args, {
    env,
    stdio: 'inherit',
    shell: true,
    cwd: projectRoot
  });

  if (result.status === 0) {
    console.log('\n\x1b[32m[Éxito] ¡La actualización se publicó correctamente apuntando a Producción y con cachés limpios!\x1b[0m\n');
  } else {
    console.error('\n\x1b[31m[Fallo] Ocurrió un error al ejecutar "eas update". Revisa los logs de arriba.\x1b[0m\n');
    process.exit(result.status || 1);
  }
}
