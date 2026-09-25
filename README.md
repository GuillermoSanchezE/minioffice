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
| consumo       | Cuánto te queda de tu plan (5 horas y semana) y tokens por hora, día, agente y modelo      |
| tareas        | Tablero (arrastrar entre columnas) o lista; los agentes también escriben tarjetas          |
| pregúntame    | Lo que los agentes te preguntan (`"para": "usuario"`), con opciones rápidas                |
| bandeja       | Todos los mensajes entre agentes, contigo y de fuera                                       |
| disparadores  | Horarios, auto-compactar contexto, webhook local con clave y otras oficinas                |
| memoria       | Búsqueda local en memorias, pizarra, mensajes y tareas; editar la pizarra                  |
| grafo         | Quién habla con quién y qué tareas tiene cada uno                                          |
| actividad     | Registro de todo lo que pasa en la oficina                                                 |
| comandos      | Iniciar/detener a todos, difundir un mensaje, comandos guardados, `/compact` a todos       |
| temporales    | Ayudantes de una sola tarea (`claude -p`) que se van cuando terminan                       |
| capacidades   | Skills por agente (con explicación en español), servidores MCP, motores y "quién tiene qué" |
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

## Instalar en tu Mac

**Con el instalador (.dmg).** En GitHub, entra a **Actions → Instalador para Mac → Run workflow**.
Cuando termine (unos minutos), descarga el artefacto `minioffice-mac`: trae
`minioffice-<versión>-arm64.dmg` (Mac con Apple Silicon, M1 en adelante) y `…-x64.dmg` (Intel).
Si subes una etiqueta `v0.4.0`, el mismo workflow lo publica en **Releases**.

**O constrúyelo en tu Mac**: `npm install && npm run dist:mac` deja el .dmg en `dist/`.

La primera vez que la abras:

1. Arrastra minioffice a Aplicaciones y ábrela. Como no está firmada con un certificado de
   desarrollador de Apple, macOS la bloquea: ve a **Ajustes del Sistema → Privacidad y seguridad**
   y pulsa **Abrir igualmente** (o en la Terminal: `xattr -dr com.apple.quarantine /Applications/minioffice.app`).
2. Elige la carpeta del proyecto donde trabajará la oficina. Se recuerda; para cambiarla:
   **Ajustes → Abrir otro proyecto…**.
3. Necesitas [Claude Code](https://docs.claude.com/en/docs/claude-code) instalado y con tu sesión
   iniciada (que `claude` funcione en la Terminal) y git. minioffice toma el PATH de tu Terminal, así
   que los encuentra aunque la abras desde el Dock.

## Requisitos para desarrollo

- Node.js 22 o superior y git
- Claude Code instalado y con sesión iniciada
- `node-pty` trae binarios para Mac y Windows; en Linux necesitas `build-essential` y `python3`

## Uso en desarrollo

```bash
npm install
npm run dev
```

En desarrollo la oficina trabaja en la carpeta desde donde lo lanzas. Michael arranca solo (se
puede apagar en Ajustes). `npm run build` compila en `out/` y `npm start` la abre sin el servidor
de desarrollo.

## Consumo y tu plan

La pestaña **consumo** muestra lo mismo que claude.ai en **Ajustes → Uso**: el porcentaje usado
de tu sesión de 5 horas y de tu semana, con la hora de reinicio y a qué ritmo vas. Claude Code se
lo pasa a minioffice por su barra de estado; aparece en cuanto un agente trabaja con tu suscripción
(Pro o Max). Ese límite es compartido: lo gastan Claude, Claude Code y esta oficina.

Debajo, los tokens que procesó cada agente por hora o por día (leídos de sus transcripciones), el
reparto por agente y por modelo, y lo que costaría a precio de API. Con tu plan no pagas ese costo:
sirve para comparar. En la barra de título hay un indicador compacto del plan.

## El reparto

La oficina se dedica a software y páginas web (se cambia en Ajustes). Cada personaje conserva su
personalidad de la serie y tiene un puesto de software con skills sugeridas:

| id         | Personaje       | Puesto                            | Skills sugeridas                                                         |
| ---------- | --------------- | --------------------------------- | ------------------------------------------------------------------------ |
| `michael`  | Michael Scott   | Director del proyecto (coordina)  | product-lens, verification-loop                                          |
| `dwight`   | Dwight Schrute  | Backend y bases de datos          | backend-patterns, api-design, postgres-patterns, database-migrations, error-handling |
| `jim`      | Jim Halpert     | Frontend (React y Next.js)        | frontend-patterns, react-patterns, nextjs-turbopack, react-performance   |
| `pam`      | Pam Beesly      | Diseño UI/UX                      | ui-ux-pro-max, design-system, ui-styling, frontend-design                |
| `andy`     | Andy Bernard    | SEO y páginas de venta            | seo, banner-design, make-interfaces-feel-better                          |
| `ryan`     | Ryan Howard     | Producto y crecimiento            | product-lens, seo                                                        |
| `kelly`    | Kelly Kapoor    | Textos y contenido                | brand, brand-voice, article-writing                                      |
| `angela`   | Angela Martin   | QA y pruebas                      | tdd-workflow, e2e-testing, webapp-testing, react-testing, verification-loop |
| `kevin`    | Kevin Malone    | Mantenimiento y tareas pequeñas   | coding-standards, git-workflow                                           |
| `oscar`    | Oscar Martinez  | Arquitectura y revisión de código | coding-standards, architecture-decision-records, error-handling, verification-loop |
| `stanley`  | Stanley Hudson  | Documentación                     | codebase-onboarding, documentation-lookup                                |
| `phyllis`  | Phyllis Vance   | Accesibilidad                     | accessibility, ui-ux-pro-max, make-interfaces-feel-better                |
| `creed`    | Creed Bratton   | DevOps y despliegues              | deployment-patterns, docker-patterns, github-ops                         |
| `meredith` | Meredith Palmer | Integraciones y APIs externas     | api-design, mcp-builder, error-handling                                  |
| `toby`     | Toby Flenderson | Seguridad                         | security-review, error-handling                                          |

Las sesiones se abren al iniciarlas o cuando les llega un mensaje.

## Skills por agente

En **capacidades → Skills por agente** eliges las skills de cada trabajador. Cada una tiene una
explicación corta en español de para qué sirve antes de marcarla; las que no están en el catálogo
se pueden explicar con un clic (lo resume Claude Code y queda guardado).

- **Catálogo**: 5 skills de [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
  (MIT), 36 de [ECC · Everything Claude Code](https://github.com/affaan-m/everything-claude-code)
  (MIT, elegidas entre sus 292 por ser útiles para software y web) y 9 de
  [Anthropic](https://github.com/anthropics/skills).
- **Biblioteca**: se descargan a `~/.minioffice/skills/` la primera vez que alguien las necesita.
- **Solo las suyas**: al iniciar la sesión de un agente, minioffice arma un plugin con sus skills y
  se lo pasa a Claude Code con `--plugin-dir`. Pam carga las de diseño y Dwight las de backend; nadie
  gasta contexto en lo que no usa. Las skills de `~/.claude/skills` siguen siendo de todos.
- **Sugeridas para todo el equipo** instala y asigna de una vez las de cada puesto (se suman, no se
  quita nada). Los cambios se aplican al reiniciar la sesión del agente.
- `ui-ux-pro-max` usa un buscador local en Python 3.

## Configurar tu equipo

Lo más cómodo es el asistente (**contratar** o el lápiz de cada tarjeta): guarda en
`minioffice.config.json`, en la carpeta desde donde lanzas la app. A mano:

```json
{
  "coordinador": { "modelo": "claude-opus-5" },
  "agentes": [
    { "id": "dwight", "cwd": "../mi-proyecto", "aislamientoGit": true, "skills": ["backend-patterns", "api-design"] },
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
| `skills`         | Skills de la biblioteca que carga su sesión, por ejemplo `["ui-ux-pro-max", "seo"]`. |
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
├── uso/                    consumo por hora y último dato del plan (no entra en git)
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
│   ├── capacidades.ts    MCP y motores
│   ├── skills.ts         biblioteca de skills y plugin de cada agente
│   ├── consumo.ts        tokens por hora y uso del plan
│   ├── entorno.ts        carpeta del proyecto y PATH de la app instalada
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

- **Voz dentro de la app**: todavía no hay botón de micrófono. El dictado del sistema sí funciona en
  cualquier caja de texto (macOS: pulsa dos veces `Fn` o la tecla 🌐; Windows: `Win + H`).
- **Slack**: no hay conexión con Slack; para avisos de fuera usa el webhook.
- **Firma de Apple**: el .dmg va firmado ad hoc, no con un certificado de desarrollador; por eso
  macOS pide confirmación la primera vez.
