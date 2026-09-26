import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { claudeConfiaEn, rutaEjecutable } from '../../src/main/requisitos'

afterEach(() => {
  delete process.env['CLAUDE_CONFIG_DIR']
})

describe('requisitos', () => {
  it('la confianza de Claude Code vale para las subcarpetas', () => {
    const config = mkdtempSync(join(tmpdir(), 'mo-claude-'))
    process.env['CLAUDE_CONFIG_DIR'] = config
    writeFileSync(join(config, '.claude.json'), JSON.stringify({ projects: { '/proyectos/web': { hasTrustDialogAccepted: true }, '/otro': {} } }))
    expect(claudeConfiaEn('/proyectos/web')).toBe(true)
    expect(claudeConfiaEn('/proyectos/web/src')).toBe(true)
    expect(claudeConfiaEn('/otro')).toBe(false)
    expect(claudeConfiaEn('/proyectos')).toBe(false)
  })

  it('sin configuración de Claude Code no hay confianza', () => {
    process.env['CLAUDE_CONFIG_DIR'] = mkdtempSync(join(tmpdir(), 'mo-claude-'))
    expect(claudeConfiaEn('/cualquiera')).toBe(false)
  })

  it('encuentra ejecutables por ruta relativa a la carpeta', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mo-bin-'))
    mkdirSync(join(dir, 'bin'))
    writeFileSync(join(dir, 'bin', 'mi-cli'), '#!/bin/sh\n', { mode: 0o755 })
    expect(rutaEjecutable('./bin/mi-cli', dir)).toBe(join(dir, 'bin', 'mi-cli'))
    expect(rutaEjecutable('no-existe-seguro-123')).toBeNull()
  })
})
