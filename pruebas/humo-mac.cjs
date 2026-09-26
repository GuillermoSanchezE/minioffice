/**
 * Prueba de humo de la app instalada, tal cual se distribuye (sin depurador):
 * - arranca con un `claude` de mentira y comprueba que Michael abre su terminal
 *   (node-pty y spawn-helper) y que hay ventana;
 * - mide memoria y CPU en reposo;
 * - al salir (SIGTERM, como al cerrar sesión en macOS) no deben quedar procesos;
 * - con --comprobar-bloqueo, la app debe negarse a arrancar con el depurador remoto.
 *
 *   node pruebas/humo-mac.cjs <ejecutable> <etiqueta> [minutos] [--rosetta] [--espera=90] [--comprobar-bloqueo] [--banderas de la app]
 *
 * Deja el resultado en humo-<etiqueta>.json y sale con error si algo falla.
 */
const { spawn, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')

const [relativo, etiqueta, minutos = '3', ...resto] = process.argv.slice(2)
if (!relativo || !etiqueta) {
  console.error('Uso: node pruebas/humo-mac.cjs <ejecutable> <etiqueta> [minutos] [--rosetta] [--espera=90] [--comprobar-bloqueo]')
  process.exit(2)
}
const ejecutable = path.resolve(relativo)
const rosetta = resto.includes('--rosetta')
const comprobarBloqueo = resto.includes('--comprobar-bloqueo')
const espera = Number(resto.find((a) => a.startsWith('--espera='))?.slice('--espera='.length) ?? 90)
const PROPIAS = ['--rosetta', '--comprobar-bloqueo']
// Otras banderas pasan a la app (p. ej. --no-sandbox al probar en Linux como root).
const extra = resto.filter((a) => a.startsWith('--') && !PROPIAS.includes(a) && !a.startsWith('--espera='))
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

const MARCA = `minioffice-humo-${process.pid}`
const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'mo-bin-'))
const senal = path.join(bin, 'claude-arranco')
// `claude` de mentira: deja una señal y espera, para probar las terminales sin la CLI real.
fs.writeFileSync(path.join(bin, 'claude'), `#!/bin/sh\necho "${MARCA} listo"\ntouch "${senal}"\nwhile :; do sleep 5; done\n`, { mode: 0o755 })

const raizApp = ejecutable.includes('.app/') ? ejecutable.slice(0, ejecutable.indexOf('.app/') + 4) : path.dirname(ejecutable) + path.sep

/** Procesos de la app (principal, GPU, renderers) con su memoria y CPU. */
function procesos() {
  const salida = execFileSync('ps', ['-axo', 'pid=,rss=,%cpu=,command='], { encoding: 'utf8' })
  return salida
    .split('\n')
    .map((l) => /^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+(.*)$/.exec(l))
    .filter((m) => m && m[4].startsWith(raizApp) && Number(m[1]) !== process.pid)
    .map((m) => ({ pid: Number(m[1]), rssMB: Math.round(Number(m[2]) / 1024), cpu: Number(m[3]), tipo: /--type=(\w+)/.exec(m[4])?.[1] ?? 'principal' }))
}

function falsos() {
  try {
    return execFileSync('pgrep', ['-f', bin], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

function lanzar(args) {
  const env = { ...process.env, SHELL: '/usr/bin/false', PATH: `${bin}:${process.env.PATH}` }
  const [cmd, argv] = rosetta ? ['arch', ['-x86_64', ejecutable, ...args]] : [ejecutable, args]
  const hijo = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'], env })
  hijo.registro = ''
  hijo.stdout.on('data', (d) => (hijo.registro += d))
  hijo.stderr.on('data', (d) => (hijo.registro += d))
  return hijo
}

function puertoAbierto(puerto) {
  return new Promise((resolver) => {
    const s = net.connect(puerto, '127.0.0.1')
    s.once('connect', () => (s.destroy(), resolver(true)))
    s.once('error', () => resolver(false))
  })
}

async function cerrarTodo() {
  for (const pid of falsos()) process.kill(Number(pid), 'SIGKILL')
  for (const p of procesos()) process.kill(p.pid, 'SIGKILL')
  await esperar(1000)
}

;(async () => {
  const resultado = { etiqueta, rosetta, ejecutable }
  const fallos = []

  if (comprobarBloqueo) {
    // La app instalada no debe dejarse manejar con el depurador remoto de Chromium.
    const puerto = 9300 + Math.floor(Math.random() * 500)
    const proyectoBloqueo = fs.mkdtempSync(path.join(os.tmpdir(), 'mo-bloqueo-'))
    const hijo = lanzar([...extra, `--remote-debugging-port=${puerto}`, `--proyecto=${proyectoBloqueo}`])
    const salida = await new Promise((resolver) => {
      const t = setTimeout(() => resolver(null), 30_000)
      hijo.once('exit', (codigo) => (clearTimeout(t), resolver(codigo)))
    })
    resultado.bloqueoDepurador = { codigoSalida: salida, puertoAbierto: await puertoAbierto(puerto), creoHive: fs.existsSync(path.join(proyectoBloqueo, '.hive')) }
    if (salida === null) {
      fallos.push('con --remote-debugging-port la app siguió abierta')
      await cerrarTodo()
    } else if (salida !== 1 || resultado.bloqueoDepurador.creoHive) {
      fallos.push(`con --remote-debugging-port la app no se negó a arrancar (código ${salida})`)
    }
  }

  const proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'mo-humo-'))
  const t0 = Date.now()
  const app = lanzar([...extra, `--proyecto=${proyecto}`])
  // Michael arranca solo al abrir (ajuste por defecto): su terminal usa node-pty.
  for (let i = 0; i < espera * 2 && !fs.existsSync(senal); i++) await esperar(500)
  resultado.terminalFunciona = fs.existsSync(senal)
  resultado.arranqueHastaTerminalMs = resultado.terminalFunciona ? Date.now() - t0 : null
  for (let i = 0; i < 20 && !procesos().some((p) => p.tipo === 'renderer'); i++) await esperar(500)
  resultado.ventana = procesos().some((p) => p.tipo === 'renderer')
  const actividad = path.join(proyecto, '.hive', 'actividad.jsonl')
  const leerActividad = () =>
    fs.existsSync(actividad)
      ? fs.readFileSync(actividad, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.agente === 'michael').map((e) => e.texto)
      : []
  resultado.actividadMichael = leerActividad().slice(0, 5)
  if (!resultado.terminalFunciona) fallos.push(`la terminal de Michael no arrancó: ${resultado.actividadMichael.join(' | ') || 'sin actividad'}`)
  if (!resultado.ventana) fallos.push('no apareció la ventana')

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

  // Salir como lo haría macOS al cerrar sesión: no deben quedar terminales vivas.
  const tSalida = Date.now()
  const principal = procesos().find((p) => p.tipo === 'principal')
  if (principal) process.kill(principal.pid, 'SIGTERM')
  for (let i = 0; i < 30 && procesos().length; i++) await esperar(500)
  resultado.salidaMs = Date.now() - tSalida
  resultado.procesosAppTrasSalir = procesos().length
  await esperar(1000)
  resultado.huerfanosTrasSalir = falsos().length
  if (resultado.procesosAppTrasSalir) fallos.push(`${resultado.procesosAppTrasSalir} procesos de la app siguen vivos tras salir`)
  if (resultado.huerfanosTrasSalir) fallos.push(`${resultado.huerfanosTrasSalir} terminales huérfanas tras salir`)
  await cerrarTodo()
  if (app.exitCode === null) app.kill('SIGKILL')

  // Lo que la app dejó en el disco (para desinstalar).
  const casa = os.homedir()
  resultado.archivosCreados = [
    'Library/Application Support/minioffice',
    'Library/Logs/minioffice',
    '.minioffice',
    'Library/Preferences/io.github.guillermosancheze.minioffice.plist'
  ].map((r) => ({ ruta: `~/${r}`, existe: fs.existsSync(path.join(casa, r)) }))

  resultado.fallos = fallos
  fs.writeFileSync(`humo-${etiqueta}.json`, JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))
  if (fallos.length) {
    console.error(`FALLÓ:\n- ${fallos.join('\n- ')}\n${app.registro.slice(-2000)}`)
    process.exit(1)
  }
})().catch(async (e) => {
  console.error('FALLO', e)
  await cerrarTodo()
  process.exit(1)
})
