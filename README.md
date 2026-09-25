# minioffice

Tu oficina personal de agentes IA con el equipo de **The Office**. minioffice abre sesiones de
**Claude Code** como si fueran los empleados de Dunder Mifflin Scranton: cada uno tiene su
escritorio, su terminal, su memoria y su buzón. Tú le hablas a **Michael Scott** y él reparte las
tareas.

Proyecto de fan, personal y de uso privado, inspirado en la idea de
[Munder Difflin](https://github.com/chaitanyagiri/munder-difflin). Sin relación con NBC ni con la
serie. Todo el código y el arte están hechos desde cero: los personajes se dibujan con formas simples
(peinado, ropa, lentes…), sin imágenes de la serie.

## Qué hace

- **La oficina de la serie** (Pixi.js): recepción de Pam junto a la entrada, oficina de Michael,
  sala de conferencias, sala de descanso, Jim frente a Dwight, Phyllis frente a Stanley, el rincón de
  contabilidad, la cocina y el anexo con Kelly, Ryan y Toby.
- **Cada personaje en su escritorio**: sin sesión está dormido (zZ); con sesión abre los ojos y
  enciende el monitor; cuando su terminal tiene actividad teclea y aparece la burbuja "…". Los
  mensajes vuelan como sobres entre escritorios. Rueda del ratón para acercar, arrastrar para
  moverse, doble clic para ver toda la oficina, clic en un personaje para abrir su terminal.
- **Personalidad**: cada agente sabe quién es (Dwight es intenso, Stanley va al grano, Angela es
  estricta…) y lo usa en el tono de sus mensajes, sin que afecte la calidad del trabajo.
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

1. Haz clic en un personaje (en la oficina o en **Equipo**) y pulsa **Iniciar sesión**, o
2. escríbele a Michael en el chat: `@Dwight revisa el README y propón mejoras`. Sirve el nombre de
   pila (`@Pam`, `@Oscar`…). Sin `@nombre`, la tarea va al elegido en el selector.

`npm run build` genera la app en `out/` y `npm start` la abre sin el servidor de desarrollo.

## El reparto

| id         | Personaje       | Puesto                          | Dónde se sienta                    |
| ---------- | --------------- | ------------------------------- | ---------------------------------- |
| `michael`  | Michael Scott   | Gerente Regional (coordinador)  | Su oficina                         |
| `dwight`   | Dwight Schrute  | Asistente del Gerente Regional  | Frente a Jim                       |
| `jim`      | Jim Halpert     | Representante de ventas         | Frente a Dwight                    |
| `pam`      | Pam Beesly      | Recepcionista                   | Recepción                          |
| `andy`     | Andy Bernard    | Representante de ventas         | Junto a la oficina de Michael      |
| `ryan`     | Ryan Howard     | Temporal                        | Anexo                              |
| `kelly`    | Kelly Kapoor    | Atención al cliente             | Anexo                              |
| `angela`   | Angela Martin   | Jefa de contabilidad            | Contabilidad                       |
| `kevin`    | Kevin Malone    | Contador                        | Contabilidad, frente a Oscar       |
| `oscar`    | Oscar Martinez  | Contador                        | Contabilidad, frente a Kevin       |
| `stanley`  | Stanley Hudson  | Representante de ventas         | Frente a Phyllis                   |
| `phyllis`  | Phyllis Vance   | Representante de ventas         | Frente a Stanley                   |
| `creed`    | Creed Bratton   | Control de calidad              | Al fondo, junto a la ventana       |
| `meredith` | Meredith Palmer | Relaciones con proveedores      | Al fondo, junto a Creed            |
| `toby`     | Toby Flenderson | Recursos Humanos                | Anexo                              |

Michael no tiene terminal: es quien reparte. Los otros 14 son sesiones de Claude Code, y solo se
abren cuando les asignas una tarea o pulsas **Iniciar sesión**.

## Configurar tu equipo

Edita `minioffice.config.json` en la carpeta desde donde lanzas la app. Para un personaje del
reparto basta el `id`; lo más útil es apuntar su `cwd` al proyecto en el que quieres que trabaje:

```json
{
  "agentes": [
    { "id": "dwight", "cwd": "../mi-proyecto" },
    { "id": "oscar", "cwd": "../contabilidad", "args": ["--model", "opus"] },
    { "id": "darryl", "nombre": "Darryl Philbin", "rol": "Jefe de almacén", "personalidad": "Tranquilo y con los pies en la tierra." }
  ]
}
```

| Campo          | Qué es                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `id`           | Identificador en minúsculas (letras, números, `-`, `_`). `michael` está reservado.             |
| `nombre`       | Nombre visible. Para el reparto ya viene puesto.                                               |
| `rol`          | Puesto; se le dice al agente en su system prompt.                                              |
| `personalidad` | Cómo es el personaje; lo usa en el tono de sus mensajes.                                       |
| `comando`      | CLI a ejecutar. Por defecto `claude`.                                                          |
| `args`         | Argumentos extra, por ejemplo `["--model", "sonnet"]`.                                         |
| `cwd`          | Carpeta de trabajo del agente, relativa a donde lanzas minioffice.                             |

Si quitas a alguien de la lista, no aparece en la oficina. Los agentes que no son del reparto
(como Darryl en el ejemplo) ocupan escritorios libres y reciben un aspecto generado a partir de su id.

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
├── renderer/             interfaz React: terminal, chat con Michael
│   └── oficina/          plano de la oficina, dibujo de los personajes y la escena animada
└── shared/               tipos compartidos y el reparto (roles, personalidad y aspecto)
```

## Qué falta (siguientes etapas)

- Michael como agente con IA propia (hoy reparte por `@nombre` o por el selector; no decide solo).
- Búsqueda en la memoria de los agentes desde la interfaz.
- Soporte para más CLIs (Codex, Gemini…): hoy funcionan como terminal, pero sin las instrucciones
  del buzón que recibe `claude`.
- Empaquetar como app instalable.
