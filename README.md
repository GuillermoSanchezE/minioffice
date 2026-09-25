# minioffice

Tu oficina personal de agentes IA con el equipo de **The Office**. minioffice abre sesiones de
**Claude Code** como si fueran los empleados de Dunder Mifflin Scranton: cada uno tiene su
escritorio, su terminal, su memoria y su buzón. Tú le hablas a **Michael Scott** (otra sesión de
Claude Code) y él reparte el trabajo.

Proyecto de fan, personal y de uso privado, inspirado en
[Munder Difflin](https://github.com/chaitanyagiri/munder-difflin). Sin relación con NBC ni con la
serie. Todo el código y el arte están hechos desde cero: los personajes se dibujan en pixel art con
código, sin imágenes de la serie.

## Qué hace

**La oficina** (Pixi.js, pixel art): recepción de Pam, oficina de Michael, sala de conferencias,
descanso, Jim frente a Dwight, Phyllis frente a Stanley, contabilidad, cocina y el anexo.

- Quien trabaja se queda en su escritorio tecleando, con un globo de lo que hace (`$ usando Bash`,
  `pensando…`, `esperando permiso`). Quien está libre, o sin sesión, **se levanta y camina** (A*
  entre los muebles) a la cafetera, a la máquina de snacks, a regar las plantas o a visitar a un
  compañero, con frases de la serie. Sin sesión, al volver a su silla se duerme (zZ).
- Los mensajes vuelan como sobres entre escritorios. Rueda para acercar, arrastrar para moverse,
  doble clic para ver todo, clic en alguien para abrir su panel.
- Abajo, las tarjetas de todo el equipo con su cara, estado, herramienta en uso y contexto.

**El centro de mando** (panel derecho, con Michael):

| Pestaña       | Para qué                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------ |
| terminal      | La terminal real de Michael y una cola de mensajes (`@Dwight …` le habla directo a Dwight) |
| monitor       | Despachar tareas vía Michael, tokens, contexto, costo estimado, límite por agente, motor    |
| tareas        | Tablero (arrastrar entre columnas) o lista; los agentes también escriben tarjetas          |
| pregúntame    | Lo que los agentes te preguntan (`"para": "usuario"`), con opciones rápidas                |
| bandeja       | Todos los mensajes entre agentes, contigo y de fuera                                       |
| disparadores  | Horarios, auto-compactar contexto, webhook local con clave y otras oficinas                |
| memoria       | Búsqueda local en memorias, pizarra, mensajes y tareas; editar la pizarra                  |
| grafo         | Quién habla con quién y qué tareas tiene cada uno                                          |
| actividad     | Registro de todo lo que pasa en la oficina                                                 |
| comandos      | Iniciar/detener a todos, difundir un mensaje, comandos guardados, `/compact` a todos       |
| temporales    | Ayudantes de una sola tarea (`claude -p`) que se van cuando terminan                       |
| capacidades   | Skills, servidores MCP y motores: catálogo, instaladas y "quién tiene qué"                 |
| equipo        | Todos los agentes en tarjetas con resumen del jefe (gasto, frenos, tareas, preguntas)      |
| grapadora     | La criatura flotante: cara, forma, expresión, tamaño, color, opacidad, acciones, capturas  |

**Panel de cada agente**: pausar, interrumpir (Esc), reiniciar retomando la conversación,
detener; guiarlo al momento; terminal, git (rama, cambios, commits), sus mensajes y sus trazas
(cada herramienta que usó, leída de la transcripción de Claude Code).

**Contratar**: asistente de 4 pasos (identidad y aspecto, carpeta y worktree de git, motor y
modelo, encargo y límite). También importar/exportar el agente como JSON o **generarlo con IA**.

**Vista completa** (botón *Completa*): barra lateral con secciones y agentes agrupados por
proyecto. **Tema crema** como el original, o noche.

**La grapadora**: una criatura que flota sobre todas tus apps. Un clic abre su menú: captura de
pantalla (y mandársela a Michael), pedirle algo a Michael sin abrir la oficina, ver preguntas,
abrir la oficina, ocultarla. Se arrastra a donde quieras.

**Motores**: Claude Code tiene integración completa (instrucciones por system prompt, estado y
tokens leídos de su transcripción). Codex, Gemini CLI, Grok, Kimi, Qwen, OpenCode, Crush, Pi,
Copilot o un comando propio funcionan como terminal y reciben las instrucciones como primer
mensaje.

**Permisos**: *Manual*, *Auto* (Claude Code aprueba lo seguro, por defecto), *Aceptar ediciones*
o *Sin permisos*. Se cambia desde el botón **auto** del centro de mando.

## Requisitos

- Node.js 22 o superior y git
- [Claude Code](https://docs.claude.com/en/docs/claude-code) instalado y con sesión iniciada (el
  comando `claude` tiene que funcionar en tu terminal)
- Si `node-pty` no trae binario para tu sistema, herramientas para compilarlo:
  macOS `xcode-select --install`; Windows, Visual Studio Build Tools con C++; Linux,
  `build-essential` y `python3`

## Uso

```bash
npm install
npm run dev
```

La primera vez, Electron descarga su binario. Michael arranca solo (se puede apagar en Ajustes).
Escríbele en la cola de su terminal o despacha desde **monitor**. `npm run build` genera la app en
`out/` y `npm start` la abre sin el servidor de desarrollo.

## El reparto

| id         | Personaje       | Puesto                         | Dónde se sienta              |
| ---------- | --------------- | ------------------------------ | ---------------------------- |
| `michael`  | Michael Scott   | Gerente Regional (coordinador) | Su oficina                   |
| `dwight`   | Dwight Schrute  | Asistente del Gerente Regional | Frente a Jim                 |
| `jim`      | Jim Halpert     | Representante de ventas        | Frente a Dwight              |
| `pam`      | Pam Beesly      | Recepcionista                  | Recepción                    |
| `andy`     | Andy Bernard    | Representante de ventas        | Junto a la oficina de Michael |
| `ryan`     | Ryan Howard     | Temporal                       | Anexo                        |
| `kelly`    | Kelly Kapoor    | Atención al cliente            | Anexo                        |
| `angela`   | Angela Martin   | Jefa de contabilidad           | Contabilidad                 |
| `kevin`    | Kevin Malone    | Contador                       | Contabilidad                 |
| `oscar`    | Oscar Martinez  | Contador                       | Contabilidad                 |
| `stanley`  | Stanley Hudson  | Representante de ventas        | Frente a Phyllis             |
| `phyllis`  | Phyllis Vance   | Representante de ventas        | Frente a Stanley             |
| `creed`    | Creed Bratton   | Control de calidad             | Al fondo                     |
| `meredith` | Meredith Palmer | Relaciones con proveedores     | Al fondo, junto a Creed      |
| `toby`     | Toby Flenderson | Recursos Humanos               | Anexo                        |

Cada agente sabe quién es y lo usa en el tono de sus mensajes, sin que afecte a la calidad del
trabajo. Las sesiones se abren al iniciarlas o cuando les llega un mensaje.

## Configurar tu equipo

Lo más cómodo es el asistente (**contratar** o el lápiz de cada tarjeta): guarda en
`minioffice.config.json`, en la carpeta desde donde lanzas la app. A mano:

```json
{
  "coordinador": { "modelo": "claude-opus-5" },
  "agentes": [
    { "id": "dwight", "cwd": "../mi-proyecto", "aislamientoGit": true },
    { "id": "oscar", "cwd": "../contabilidad", "modelo": "claude-sonnet-5", "limiteTokens": 2000000 },
    { "id": "kevin", "proveedor": "codex" },
    { "id": "darryl", "nombre": "Darryl Philbin", "rol": "Jefe de almacén", "personalidad": "Tranquilo y con los pies en la tierra." }
  ]
}
```

| Campo            | Qué es                                                                              |
| ---------------- | ----------------------------------------------------------------------------------- |
| `id`             | Minúsculas, números, `-`, `_`. `michael` está reservado para el coordinador.        |
| `nombre`, `rol`, `personalidad` | Para el reparto ya vienen puestos.                                   |
| `personaje`      | Id del reparto cuyo aspecto usa (por defecto, el propio id).                        |
| `proveedor`      | `claude` (por defecto), `codex`, `gemini`, `grok`, `kimi`, `qwen`, `opencode`, `crush`, `pi`, `copilot` o `personalizado` |
| `modelo`         | Para `--model`; vacío usa el predeterminado de la CLI.                              |
| `comando`, `args`| Comando propio (con `personalizado`) y argumentos extra.                            |
| `cwd`            | Carpeta de trabajo, relativa a donde lanzas minioffice.                             |
| `aislamientoGit` | Trabaja en su propio worktree, rama `minioffice/<id>`.                              |
| `descripcion`, `objetivo`, `nota`, `limiteTokens`, `reanudar` | Encargo, nota visible, freno de tokens e id de sesión a retomar. |

## El hive (`.hive/`)

Un repositorio git local en la carpeta desde donde lanzas la app (está en `.gitignore`). Solo
minioffice hace commits.

```
.hive/
├── pizarra.md              notas compartidas por todo el equipo
├── ajustes.json            ajustes de la oficina (permisos, horarios, webhooks…)
├── actividad.jsonl         registro de actividad
├── tareas/<id>.json        el tablero
├── preguntas/<id>.json     lo que te preguntan
├── capturas/               capturas de la grapadora (no entran en git)
└── agentes/<id>/
    ├── memoria.md          lo que el agente quiere recordar entre sesiones
    └── buzon/{entrada,salida,enviados,rechazados}/
```

Un agente escribe a otro dejando `{"para": "<id>", "cuerpo": "..."}` en su `buzon/salida/`;
`"para": "usuario"` te hace una pregunta y `"para": "fuera:<id>"` le escribe a otra oficina.

## Webhook local

En **disparadores** puedes encender un servidor HTTP (por defecto `127.0.0.1:4717`, con clave):

```bash
curl -X POST http://127.0.0.1:4717/mensaje \
  -H "Authorization: Bearer <clave>" -H "Content-Type: application/json" \
  -d '{"texto": "Revisa el despliegue", "para": "michael"}'
```

`GET /estado` devuelve quién está en la oficina y qué hace.

## Estructura del código

```
src/
├── main/                 proceso principal de Electron
│   ├── oficina.ts        el motor: sesiones, estados, colas, tareas, preguntas, acciones
│   ├── transcripcion.ts  lee la transcripción de Claude Code (herramientas, tokens, costo)
│   ├── pty/              terminales (node-pty)
│   ├── hive/             almacenamiento del hive y router de buzones
│   ├── agents/           instrucciones de cada sesión
│   ├── disparadores.ts   horarios y webhook
│   ├── temporales.ts     ayudantes `claude -p`
│   ├── capacidades.ts    skills, MCP y motores
│   └── grapadora.ts      ventana flotante y capturas
├── preload/              API segura para la ventana (window.minioffice)
├── renderer/             interfaz React
│   ├── components/       centro de mando, pestañas, panel de agente, asistente…
│   ├── oficina/          plano, caminos (A*) y escena animada
│   ├── pixel/            dibujo de personajes y retratos
│   └── grapadora/        la criatura flotante
└── shared/               tipos, acciones, motores y el reparto
```

## Lo que no incluye

- **Voz**: dictar mensajes o grabar y transcribir reuniones necesita un servicio de voz a texto.
- **Slack**: no hay conexión con Slack; para avisos de fuera usa el webhook.
- **Instalador**: se ejecuta con `npm run dev` / `npm start`, sin empaquetar.
