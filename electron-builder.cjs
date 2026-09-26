/**
 * Instalador de minioffice. En Mac: npm run dist:mac (o el workflow de GitHub).
 *
 * Firma:
 * - Con un certificado Developer ID (CSC_LINK y CSC_KEY_PASSWORD) firma con él y,
 *   si están las claves de App Store Connect (APPLE_API_KEY, APPLE_API_KEY_ID y
 *   APPLE_API_ISSUER), además notariza: se abre sin avisos en cualquier Mac.
 * - Sin certificado firma ad hoc: sirve en tu Mac, pero Gatekeeper la bloquea al
 *   descargarla y macOS olvida sus permisos en cada versión.
 * En los dos casos va con Hardened Runtime.
 */
const conCertificado = Boolean(process.env.CSC_LINK || process.env.CSC_NAME)
const notarizar =
  conCertificado &&
  Boolean(
    (process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER) ||
      (process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID)
  )

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'io.github.guillermosancheze.minioffice',
  productName: 'minioffice',
  copyright: 'Proyecto personal, uso privado.',

  directories: {
    output: 'dist',
    buildResources: 'build'
  },

  files: ['out/**', 'package.json'],

  // Fusibles de Electron: nadie puede arrancar la app como un Node cualquiera (y usar sus
  // permisos de micrófono y pantalla), ni pasarle NODE_OPTIONS o el depurador de Node.
  // El file:// con privilegios se queda: el dictado carga su motor WebAssembly así.
  electronFuses: {
    runAsNode: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    grantFileProtocolExtraPrivileges: true
  },

  // node-pty trae binarios para Mac (arm64 y x64) y usa N-API: no hace falta recompilar.
  npmRebuild: false,
  asarUnpack: ['node_modules/node-pty/**'],
  // Da permiso de ejecución a spawn-helper (sin él no hay terminales) y quita los binarios
  // de otras plataformas. Corre antes de firmar.
  afterPack: 'scripts/preparar-node-pty.cjs',

  mac: {
    target: [{ target: 'dmg', arch: ['arm64', 'x64'] }],
    category: 'public.app-category.developer-tools',
    icon: 'build/icon.png',
    identity: conCertificado ? undefined : '-',
    hardenedRuntime: true,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    gatekeeperAssess: false,
    notarize: notarizar,
    extendInfo: {
      NSMicrophoneUsageDescription: 'minioffice usa el micrófono para que dictes mensajes a tus agentes.',
      NSScreenCaptureUsageDescription: 'La grapadora captura la pantalla cuando se lo pides.'
    }
  },

  // Ventana del instalador: fondo crema con la flecha hacia Aplicaciones (build/background.png y @2x).
  dmg: {
    title: 'minioffice',
    artifactName: 'minioffice-${version}-${arch}.dmg',
    sign: conCertificado,
    background: 'build/background.png',
    iconSize: 110,
    window: { width: 660, height: 400 },
    contents: [
      { x: 180, y: 190 },
      { x: 480, y: 190, type: 'link', path: '/Applications' }
    ]
  },

  linux: {
    target: 'dir',
    icon: 'build/icon.png'
  }
}
