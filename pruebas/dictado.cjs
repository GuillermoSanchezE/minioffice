/**
 * Prueba de punta a punta del dictado: la app arranca con un micrófono simulado
 * que "dice" un WAV, descarga Whisper de verdad, graba, transcribe y comprueba
 * que el texto se parece a lo dicho.
 *
 *   node pruebas/dictado.cjs <audio.wav> <segundos> <base|small> [ejecutable] [carpeta-capturas]
 *
 * Sin ejecutable usa el build de desarrollo (out/). Palabras esperadas en ESPERADO
 * (separadas por comas); aprueba si aparece al menos la mitad.
 */
const { _electron: electron } = require('playwright-core')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const [wav, segundos, modelo = 'base', ejecutable, capturas = 'capturas-dictado'] = process.argv.slice(2)
if (!wav || !segundos) {
  console.error('Uso: node pruebas/dictado.cjs <audio.wav> <segundos> <base|small> [ejecutable] [capturas]')
  process.exit(2)
}
const esperado = (process.env.ESPERADO || 'michael,formulario,contacto,pagina,errores').split(',')
const normalizar = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

;(async () => {
  fs.mkdirSync(capturas, { recursive: true })
  const proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'mo-dictado-'))
  const raiz = path.resolve(__dirname, '..')
  const banderas = [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${path.resolve(wav)}`,
    // En macOS el servicio de audio va aislado y no podría leer el WAV.
    '--disable-features=AudioServiceSandbox'
  ]
  const app = await electron.launch(
    ejecutable
      ? { executablePath: ejecutable, args: [...banderas, `--proyecto=${proyecto}`] }
      : { args: [...banderas, path.join(raiz, 'out/main/index.js')], cwd: proyecto }
  )
  const errores = []
  const win = await app.firstWindow()
  win.on('pageerror', (e) => errores.push(e.message))
  win.on('console', (m) => m.type() === 'error' && errores.push(m.text().slice(0, 300)))
  await win.setViewportSize({ width: 1400, height: 880 })
  await win.waitForSelector('.barra-titulo', { timeout: 60_000 })
  await win.evaluate((m) => window.minioffice.accion({ tipo: 'dictado:ajustes', ajustes: { modelo: m, idioma: 'es' } }), modelo)

  // ¿El micrófono simulado suena? (si no, el fallo es de la prueba, no de Whisper)
  const microfono = await win.evaluate(async () => {
    const flujo = await navigator.mediaDevices.getUserMedia({ audio: true })
    const ctx = new AudioContext()
    const analizador = ctx.createAnalyser()
    ctx.createMediaStreamSource(flujo).connect(analizador)
    const datos = new Float32Array(analizador.fftSize)
    let maximo = 0
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 100))
      analizador.getFloatTimeDomainData(datos)
      let suma = 0
      for (const v of datos) suma += v * v
      maximo = Math.max(maximo, Math.sqrt(suma / datos.length))
    }
    const etiqueta = flujo.getAudioTracks()[0]?.label
    flujo.getTracks().forEach((t) => t.stop())
    await ctx.close()
    return { etiqueta, rmsMaximo: Number(maximo.toFixed(4)) }
  })
  console.log('Micrófono simulado:', JSON.stringify(microfono))
  if (microfono.rmsMaximo < 0.003) throw new Error('El micrófono simulado no suena: Chromium no pudo leer el WAV.')
  await win.click('.barra-titulo .segmentado button:has-text("Completa")')
  await win.click('.lateral-item:has-text("Monitor")')
  const campo = win.locator('.seccion textarea').first()

  // 1. Primera vez: pide descargar el modelo.
  const t0 = Date.now()
  await win.click('.boton-dictado')
  await win.waitForSelector('.dictado-panel', { timeout: 10_000 })
  await win.screenshot({ path: path.join(capturas, `${modelo}-1-panel.png`) })
  await win.click('.dictado-panel button:has-text("descargar")')
  await win.waitForTimeout(3000)
  await win.screenshot({ path: path.join(capturas, `${modelo}-2-descargando.png`) })
  await win.waitForSelector('.aviso:has-text("Dictado listo"), .aviso-error:has-text("Whisper")', { timeout: 20 * 60_000 })
  const fallo = await win.$('.aviso-error:has-text("Whisper")')
  if (fallo) throw new Error(`La descarga falló: ${await fallo.textContent()}`)
  const descarga = Date.now() - t0

  // 2. Dictar dos veces: la segunda mide el tiempo con el modelo ya cargado.
  const tiempos = []
  const textos = []
  for (let vuelta = 1; vuelta <= 2; vuelta++) {
    await campo.fill('')
    await win.click('.boton-dictado')
    await win.waitForSelector('.boton-dictado.grabando', { timeout: 15_000 })
    await win.waitForTimeout(Number(segundos) * 1000)
    if (vuelta === 1) await win.screenshot({ path: path.join(capturas, `${modelo}-3-grabando.png`) })
    const t1 = Date.now()
    await win.click('.boton-dictado')
    // Otros avisos (p. ej. que no encuentra `claude` en la máquina de pruebas) no cuentan.
    const errorDictado = () =>
      [...document.querySelectorAll('.aviso-error')].map((a) => a.textContent).find((t) => /transcribir|No se oy|No entend|micr[oó]fono/i.test(t)) ?? null
    await win.waitForFunction(
      () =>
        document.querySelector('.seccion textarea')?.value.trim() ||
        [...document.querySelectorAll('.aviso-error')].some((a) => /transcribir|No se oy|No entend|micr[oó]fono/i.test(a.textContent)),
      null,
      { timeout: 5 * 60_000 }
    )
    const error = await win.evaluate(errorDictado)
    if (error) throw new Error(`La transcripción falló: ${error}`)
    tiempos.push(Date.now() - t1)
    textos.push(await campo.inputValue())
    await win.waitForSelector('.boton-dictado:not(.transcribiendo)')
  }
  await win.screenshot({ path: path.join(capturas, `${modelo}-4-texto.png`) })

  const texto = normalizar(textos[0])
  const aciertos = esperado.filter((p) => texto.includes(normalizar(p)))
  const resultado = {
    modelo,
    empaquetada: !!ejecutable,
    textos,
    aciertos,
    descargaYCargaMs: descarga,
    transcripcionMs: tiempos,
    hilos: await win.evaluate(() => navigator.hardwareConcurrency),
    errores
  }
  fs.writeFileSync(path.join(capturas, `resultado-${modelo}${ejecutable ? '-app' : ''}.json`), JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify(resultado, null, 2))
  await app.close()
  if (aciertos.length < Math.ceil(esperado.length / 2)) {
    console.error(`Whisper no entendió la frase (${aciertos.length}/${esperado.length} palabras).`)
    process.exit(1)
  }
})().catch((e) => {
  console.error('FALLO', e)
  process.exit(1)
})
