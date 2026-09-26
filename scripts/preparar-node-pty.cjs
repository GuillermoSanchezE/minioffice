/**
 * node-pty 1.1.0 publica el spawn-helper de macOS sin permiso de ejecución, y sin
 * él no se abre ninguna terminal ("posix_spawnp failed").
 *
 * - Como postinstall, se lo da en node_modules (para `npm run dev` en Mac).
 * - Como afterPack de electron-builder (antes de firmar), se lo da dentro de la app
 *   y deja solo los binarios de la plataforma y arquitectura que se empaquetan.
 */
const fs = require('node:fs')
const path = require('node:path')

function darPermiso(helper) {
  fs.chmodSync(helper, 0o755)
  if ((fs.statSync(helper).mode & 0o111) === 0) throw new Error(`No se pudo dar permiso de ejecución a ${helper}`)
}

/** @param {import('app-builder-lib').AfterPackContext} ctx */
async function despuesDeEmpaquetar(ctx) {
  const { Arch } = require('builder-util')
  const plataforma = ctx.electronPlatformName
  const recursos =
    plataforma === 'darwin'
      ? path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
      : path.join(ctx.appOutDir, 'resources')
  const prebuilds = path.join(recursos, 'app.asar.unpacked', 'node_modules', 'node-pty', 'prebuilds')
  if (!fs.existsSync(prebuilds)) {
    if (plataforma === 'darwin') throw new Error(`No está node-pty desempaquetado en ${prebuilds}`)
    return
  }
  const propio = `${plataforma}-${Arch[ctx.arch]}`
  for (const carpeta of fs.readdirSync(prebuilds)) {
    if (carpeta !== propio) fs.rmSync(path.join(prebuilds, carpeta), { recursive: true, force: true })
  }
  if (plataforma === 'darwin') {
    const helper = path.join(prebuilds, propio, 'spawn-helper')
    if (!fs.existsSync(helper)) throw new Error(`Falta ${helper}: sin él no se abren las terminales.`)
    darPermiso(helper)
    console.log(`  • node-pty: ${propio}/spawn-helper ejecutable; quitados los binarios de otras plataformas`)
  }
}

module.exports = despuesDeEmpaquetar
module.exports.default = despuesDeEmpaquetar

if (require.main === module) {
  const prebuilds = path.join(__dirname, '..', 'node_modules', 'node-pty', 'prebuilds')
  if (fs.existsSync(prebuilds)) {
    for (const carpeta of fs.readdirSync(prebuilds).filter((c) => c.startsWith('darwin-'))) {
      const helper = path.join(prebuilds, carpeta, 'spawn-helper')
      if (fs.existsSync(helper)) darPermiso(helper)
    }
  }
}
