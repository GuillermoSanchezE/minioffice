/**
 * Prueba de humo de la app instalada en un Mac: arranca, abre la oficina, lanza
 * la terminal de Michael (con un `claude` de mentira), mide memoria y CPU en reposo
 * y comprueba que al salir no quedan procesos huérfanos.
 *
 *   node pruebas/humo-mac.cjs <ejecutable> <etiqueta> [minutos-en-reposo] [--rosetta]
 *
 * Deja el resultado en humo-<etiqueta>.json.
 */
const { chromium } = require('playwright-core')
const { spawn, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const [ejecutable, etiqueta, minutos = '3', ...resto] = process.argv.slice(2)
if (!ejecutable || !etiqueta) {
  console.error('Uso: node pruebas/humo-mac.cjs <ejecutable> <etiqueta> [minutos] [--rosetta]')
  process.exit(2)
}
const rosetta = resto.includes('--rosetta')
// Otras banderas pasan a la app (p. ej. --no-sandbox al probar en Linux como root).
const extra = resto.filter((a) => a.startsWith('--') && a !== '--rosetta')
const MARCA = `minioffice-humo-${process.pid}`
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'mo-bin-'))

/** Procesos de la app (principal, GPU, renderers) con su memoria y CPU. */
function procesos() {
  const salida = execFileSync('ps', ['-axo', 'pid=,rss=,%cpu=,command='], { encoding: 'utf8' })
  const app = ejecutable.includes('.app/') ? ejecutable.slice(0, ejecutable.indexOf('.app/') + 4) : path.dirname(ejecutable) + path.sep
  return salida
    .split('\n')
    .map((l) => /^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+(.*)$/.exec(l))
    .filter((m) => m && m[4].startsWith(app) && Number(m[1]) !== process.pid)
    .map((m) => ({ pid: Number(m[1]), rssMB: Math.round(Number(m[2]) / 1024), cpu: Number(m[3]), tipo: /--type=(\w+)/.exec(m[4])?.[1] ?? 'principal' }))
}

function falsos() {
  try {
    return execFileSync('pgrep', ['-f', bin], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

;(async () => {
  const resultado = { etiqueta, rosetta, ejecutable }
  const proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'mo-humo-'))
  // `claude` de mentira: escribe una marca y espera, para probar node-pty sin la CLI real.
  fs.writeFileSync(path.join(bin, 'claude'), `#!/bin/sh\necho "${MARCA} listo"\nwhile :; do sleep 5; done\n`, { mode: 0o755 })
  const puerto = 9300 + Math.floor(Math.random() * 500)
  const args = [...extra, `--remote-debugging-port=${puerto}`, `--proyecto=${proyecto}`]
  const [cmd, argv] = rosetta ? ['arch', ['-x86_64', ejecutable, ...args]] : [ejecutable, args]
  const t0 = Date.now()
  const proceso = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'], // Sin shell de inicio: así el `claude` de mentira va primero en el PATH aunque haya uno real.
    env: { ...process.env, SHELL: '/usr/bin/false', PATH: `${bin}:${process.env.PATH}` } })
  let registro = ''
  proceso.stdout.on('data', (d) => (registro += d))
  proceso.stderr.on('data', (d) => (registro += d))

  let navegador
  for (let i = 0; i < 120 && !navegador; i++) {
    await esperar(500)
    navegador = await chromium.connectOverCDP(`http://127.0.0.1:${puerto}`).catch(() => undefined)
  }
  if (!navegador) throw new Error(`La app no abrió el puerto de depuración.\n${registro.slice(-2000)}`)
  let win
  for (let i = 0; i < 120 && !win; i++) {
    win = navegador.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes('index.html'))
    if (!win) await esperar(500)
  }
  if (!win) throw new Error('No apareció la ventana de la oficina.')
  const errores = []
  win.on('pageerror', (e) => errores.push(e.message))
  await win.waitForSelector('.barra-titulo', { timeout: 60_000 })
  resultado.arranqueMs = Date.now() - t0

  // Michael arranca solo al abrir (ajuste por defecto): su terminal usa node-pty.
  let historial = ''
  for (let i = 0; i < 40 && !historial.includes(MARCA); i++) {
    await esperar(500)
    historial = (await win.evaluate(() => window.minioffice.accion({ tipo: 'terminal:historial', id: 'michael' }))) || ''
  }
  resultado.terminalFunciona = historial.includes(`${MARCA} listo`)
  resultado.procesosFalsosVivos = falsos().length

  // Memoria y CPU en reposo.
  const muestras = []
  const fin = Date.now() + Number(minutos) * 60_000
  while (Date.now() < fin) {
    const ps = procesos()
    muestras.push({ t: Math.round((Date.now() - t0) / 1000), totalMB: ps.reduce((s, p) => s + p.rssMB, 0), cpu: +ps.reduce((s, p) => s + p.cpu, 0).toFixed(1), procesos: ps.length })
    await esperar(20_000)
  }
  resultado.muestras = muestras
  resultado.detalle = procesos()
  resultado.erroresPagina = errores

  // Salir como lo haría macOS al cerrar sesión (SIGTERM): no deben quedar terminales vivas.
  await navegador.close().catch(() => {})
  const principal = procesos().find((p) => p.tipo === 'principal')
  const tSalida = Date.now()
  if (principal) process.kill(principal.pid, 'SIGTERM')
  for (let i = 0; i < 30 && procesos().length; i++) await esperar(500)
  resultado.salidaMs = Date.now() - tSalida
  resultado.procesosAppTrasSalir = procesos().length
  resultado.huerfanosTrasSalir = falsos().length
  for (const pid of falsos()) process.kill(Number(pid), 'SIGKILL')
  for (const p of procesos()) process.kill(p.pid, 'SIGKILL')

  // Lo que la app dejó en el disco (para desinstalar).
  const casa = os.homedir()
  resultado.archivosCreados = [
    path.join(casa, 'Library/Application Support/minioffice'),
    path.join(casa, '.minioffice'),
    path.join(casa, 'Library/Preferences/local.minioffice.app.plist'),
    path.join(casa, 'Library/Saved Application State/local.minioffice.app.savedState'),
    path.join(casa, 'Library/Caches/minioffice'),
    path.join(casa, 'Library/Logs/minioffice'),
    path.join(proyecto, '.hive')
  ].map((r) => ({ ruta: r.replace(casa, '~'), existe: fs.existsSync(r) }))

  fs.writeFileSync(`humo-${etiqueta}.json`, JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))
  if (!resultado.terminalFunciona) {
    console.error(`La terminal no respondió. Historial: ${historial.slice(-500)}\n${registro.slice(-1500)}`)
    process.exit(1)
  }
})().catch((e) => {
  console.error('FALLO', e)
  process.exit(1)
})
