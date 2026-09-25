# minioffice

Tu oficina personal de agentes IA. minioffice abre varias sesiones de **Claude Code** como si fueran
empleados: cada uno tiene su escritorio en una oficina 2D, su terminal, su memoria y su buzón. Tú le
hablas a **Michael**, el coordinador, y él reparte las tareas.

Proyecto personal y de uso privado, inspirado en la idea de
[Munder Difflin](https://github.com/chaitanyagiri/munder-difflin). Todo el código y el arte están
hechos desde cero para este proyecto (no se copió código ni el tileset de Munder Difflin).

## Qué hace

- **Oficina 2D** (Pixi.js): cada agente tiene escritorio. Si su sesión está detenida espera en la
  sala de descanso; al iniciar camina a su escritorio. Mientras escribe se ve la burbuja de "…" y el
  monitor encendido. Los mensajes vuelan como sobres entre agentes.
- **Terminales reales** (node-pty + xterm.js): cada agente es una sesión interactiva de `claude`.
  Puedes escribir directamente en su terminal.
- **Michael, el coordinador**: le escribes una tarea en el chat y la deja en el buzón del agente.
  Si el agente está detenido, Michael le abre una sesión de Claude Code con la tarea ya escrita.
- **Hive compartido** (`.hive/`, un repo git local): memoria de cada agente, buzones de
  entrada/salida y una pizarra común. Solo minioffice hace commits, así el historial nunca queda a
  medias.
- **Respuestas de los agentes**: al arrancar, a cada agente se le explica (vía
  `--append-system-prompt`) cómo escribirle a Michael o a sus compañeros dejando un JSON en su
  buzón de salida. minioffice lo entrega y lo verás en el chat.

## Requisitos

- Node.js 22 o superior
- git (el hive guarda su historial con git)
- [Claude Code](https://docs.claude.com/en/docs/claude-code) instalado y con sesión iniciada
  (el comando `claude` tiene que funcionar en tu terminal)
- Herramientas para compilar módulos nativos (para `node-pty`):
  - macOS: `xcode-select --install`
  - Windows: Visual Studio Build Tools con "Desarrollo para el escritorio con C++"
  - Linux: `build-essential` y `python3`

## Uso

```bash
npm install
npm run dev
```

La primera vez que arranca, Electron descarga su binario (puede tardar un poco).

Luego:

1. Elige un agente en **Equipo** y pulsa **Iniciar sesión**, o
2. escríbele a Michael en el chat: `@Ana revisa el README y propón mejoras`. Sin `@nombre`, la tarea
   va al agente elegido en el selector.

`npm run build` genera la app en `out/` y `npm start` la abre sin el servidor de desarrollo.

## Configurar tu equipo

Edita `minioffice.config.json` en la carpeta desde donde lanzas la app:

```json
{
  "agentes": [
    {
      "id": "ana",
      "nombre": "Ana",
      "rol": "Desarrolladora",
      "comando": "claude",
      "args": [],
      "cwd": "../mi-proyecto",
      "escritorio": { "x": 2, "y": 2 }
    }
  ]
}
```

| Campo        | Qué es                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------ |
| `id`         | Identificador único en minúsculas (letras, números, `-`, `_`). `michael` está reservado.   |
| `nombre`     | Nombre visible en la oficina y en el chat.                                                 |
| `rol`        | Se le dice al agente en su system prompt.                                                  |
| `comando`    | CLI a ejecutar. Por defecto `claude`.                                                      |
| `args`       | Argumentos extra, por ejemplo `["--model", "sonnet"]`.                                     |
| `cwd`        | Carpeta de trabajo del agente, relativa a donde lanzas minioffice. Apúntala a tu proyecto. |
| `escritorio` | Posición en la oficina: `x` de 0 a 11, `y` de 0 a 7. La oficina de Michael ocupa x 9–11, y 0–2 y la sala de descanso x 0–4, y 6–7. |

## El hive (`.hive/`)

Se crea en la carpeta desde donde lanzas la app y está en `.gitignore` (es estado de tu máquina,
no código).

```
.hive/
├── pizarra.md                  notas compartidas por todo el equipo
└── agentes/<id>/
    ├── memoria.md              lo que el agente quiere recordar entre sesiones
    └── buzon/
        ├── entrada/            mensajes recibidos
        ├── salida/             el agente deja aquí {"para": "<id>", "cuerpo": "..."}
        ├── enviados/           copia de lo que ya se entregó
        └── rechazados/         JSON inválido o destinatario inexistente
```

Puedes ver toda la historia con `git -C .hive log`.

## Estructura del código

```
src/
├── main/                 proceso principal de Electron
│   ├── pty/              sesiones de terminal (node-pty) y estados de cada agente
│   ├── hive/             almacenamiento del hive y router de buzones
│   ├── agents/           instrucciones que recibe cada sesión de Claude Code
│   └── ipc/              puente entre la ventana y el proceso principal
├── preload/              API segura expuesta a la ventana (window.minioffice)
├── renderer/             interfaz React: oficina 2D, terminal, chat con Michael
└── shared/               tipos compartidos
```

## Qué falta (siguientes etapas)

- Michael como agente con IA propia (hoy reparte por `@nombre` o por el selector; no decide solo).
- Búsqueda en la memoria de los agentes desde la interfaz.
- Soporte para más CLIs (Codex, Gemini…): hoy funcionan como terminal, pero sin las instrucciones
  del buzón que recibe `claude`.
- Empaquetar como app instalable.
