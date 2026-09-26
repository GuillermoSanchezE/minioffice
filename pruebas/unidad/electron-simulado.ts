import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Lo mínimo de Electron que usan los módulos probados. */
export const carpetaUsuario = mkdtempSync(join(tmpdir(), 'mo-unidad-'))

export const electronSimulado = {
  app: {
    isPackaged: false,
    getPath: () => carpetaUsuario,
    getVersion: () => '0.3.0',
    commandLine: { hasSwitch: () => false },
    on: () => undefined,
    exit: () => undefined
  },
  dialog: { showMessageBox: async () => ({ response: 0 }) },
  session: { defaultSession: { setPermissionRequestHandler: () => undefined, setPermissionCheckHandler: () => undefined } },
  net: { fetch: async () => new Response(null, { status: 404 }) },
  safeStorage: { isEncryptionAvailable: () => false }
}
