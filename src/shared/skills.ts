/**
 * Skills que la oficina puede instalar y asignar a cada agente, con una
 * explicacion corta en espanol, y el puesto de software de cada personaje
 * con las skills que le sugerimos.
 */

export type FuenteSkill = 'uiux' | 'ecc' | 'anthropic'

export interface Fuente {
  nombre: string
  autor: string
  repo: string
  /** Carpeta del repositorio donde viven las skills. */
  carpeta: string
  licencia: string
  resumen: string
}

export const FUENTES: Record<FuenteSkill, Fuente> = {
  uiux: {
    nombre: 'UI/UX Pro Max',
    autor: 'Next Level Builder',
    repo: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git',
    carpeta: '.claude/skills',
    licencia: 'MIT',
    resumen: 'Criterio de diseño con un buscador local: 79 estilos, 192 paletas, 74 pares de fuentes y 119 reglas de UX.'
  },
  ecc: {
    nombre: 'ECC · Everything Claude Code',
    autor: 'Affaan Mustafa',
    repo: 'https://github.com/affaan-m/everything-claude-code.git',
    carpeta: 'skills',
    licencia: 'MIT',
    resumen: 'Colección de 292 flujos de ingeniería. Aquí están solo las útiles para software y web.'
  },
  anthropic: {
    nombre: 'Anthropic',
    autor: 'Anthropic',
    repo: 'https://github.com/anthropics/skills.git',
    carpeta: 'skills',
    licencia: 'la de cada skill',
    resumen: 'Las skills oficiales de Anthropic.'
  }
}

export type AreaSkill =
  | 'Diseño UI/UX'
  | 'Frontend'
  | 'Backend y datos'
  | 'Calidad y pruebas'
  | 'Seguridad'
  | 'DevOps'
  | 'Producto y contenido'
  | 'Documentación y equipo'

export const AREAS: AreaSkill[] = [
  'Diseño UI/UX',
  'Frontend',
  'Backend y datos',
  'Calidad y pruebas',
  'Seguridad',
  'DevOps',
  'Producto y contenido',
  'Documentación y equipo'
]

export interface SkillCatalogo {
  nombre: string
  fuente: FuenteSkill
  area: AreaSkill
  /** Para qué sirve, en una o dos frases. */
  resumen: string
  requiere?: string
}

const s = (nombre: string, fuente: FuenteSkill, area: AreaSkill, resumen: string, requiere?: string): SkillCatalogo => ({ nombre, fuente, area, resumen, requiere })

export const CATALOGO_SKILLS: SkillCatalogo[] = [
  // UI/UX Pro Max
  s('ui-ux-pro-max', 'uiux', 'Diseño UI/UX', 'Su diseñador experto: elige estilo, paleta y tipografía y revisa accesibilidad y UX con una base local de estilos, paletas y reglas. Para diseñar o revisar cualquier pantalla.', 'Python 3'),
  s('design-system', 'uiux', 'Diseño UI/UX', 'Arma el sistema de diseño: tokens de color, espaciado y tipografía en capas, variables CSS y especificaciones de componentes.'),
  s('ui-styling', 'uiux', 'Diseño UI/UX', 'Construye interfaces con shadcn/ui, Radix y Tailwind: componentes accesibles, modo claro y oscuro y estilos consistentes.'),
  s('banner-design', 'uiux', 'Diseño UI/UX', 'Diseña banners para redes, anuncios y portadas de sitios, con varias direcciones de arte.'),
  s('brand', 'uiux', 'Producto y contenido', 'Voz e identidad de marca: tono, mensajes y guía de estilo para que todo suene y se vea igual.'),
  // ECC: frontend
  s('frontend-patterns', 'ecc', 'Frontend', 'Buenas prácticas de React y Next.js: componentes, estado, rendimiento y orden del frontend.'),
  s('react-patterns', 'ecc', 'Frontend', 'React 18 y 19 moderno: hooks bien usados, Server Components, Suspense, formularios y carga de datos.'),
  s('react-performance', 'ecc', 'Frontend', 'Hace rápida una app React o Next: más de 70 reglas contra cargas en cascada, bundles grandes y renders de más.'),
  s('nextjs-turbopack', 'ecc', 'Frontend', 'Next.js 16 con Turbopack: configuración, caché y velocidad de desarrollo.'),
  s('vite-patterns', 'ecc', 'Frontend', 'Proyectos con Vite: plugins, variables de entorno, proxy, SSR y build optimizado.'),
  s('vue-patterns', 'ecc', 'Frontend', 'Vue 3 y Nuxt: Composition API, Pinia, rutas y SSR.'),
  s('make-interfaces-feel-better', 'ecc', 'Diseño UI/UX', 'Los detalles que hacen que una interfaz se sienta pulida: espacios, sombras, animaciones y estados al interactuar.'),
  s('frontend-design-direction', 'ecc', 'Diseño UI/UX', 'Le da una dirección visual propia a sitios, dashboards y landing pages para que no se vean genéricos.'),
  s('motion-foundations', 'ecc', 'Frontend', 'Animaciones con motion/react: tiempos, resortes, rendimiento y respeto a "reducir movimiento".'),
  // ECC: backend
  s('backend-patterns', 'ecc', 'Backend y datos', 'Arquitectura de backend en Node.js, Express y rutas de Next: APIs, acceso a datos y consultas rápidas.'),
  s('api-design', 'ecc', 'Backend y datos', 'Diseño de APIs REST: nombres de recursos, códigos de estado, paginación, errores, versiones y límites.'),
  s('nestjs-patterns', 'ecc', 'Backend y datos', 'Backends con NestJS: módulos, controladores, validación de datos, guards e interceptores.'),
  s('fastapi-patterns', 'ecc', 'Backend y datos', 'Backends en Python con FastAPI: esquemas Pydantic, dependencias, autenticación y pruebas.'),
  s('postgres-patterns', 'ecc', 'Backend y datos', 'PostgreSQL: diseño de tablas, índices, consultas lentas y seguridad por filas, al estilo Supabase.'),
  s('prisma-patterns', 'ecc', 'Backend y datos', 'Prisma ORM: esquema, consultas, transacciones, paginación y sus trampas más comunes.'),
  s('database-migrations', 'ecc', 'Backend y datos', 'Migraciones de base de datos sin cortar el servicio y con vuelta atrás (Prisma, Drizzle, Django y otros).'),
  s('error-handling', 'ecc', 'Backend y datos', 'Errores bien manejados: tipos de error, reintentos, cortacircuitos y mensajes claros para el usuario.'),
  // ECC: calidad
  s('tdd-workflow', 'ecc', 'Calidad y pruebas', 'Desarrollo guiado por pruebas: primero la prueba, luego el código, con 80% de cobertura (unitarias, integración y E2E).'),
  s('e2e-testing', 'ecc', 'Calidad y pruebas', 'Pruebas de punta a punta con Playwright: Page Objects, CI y cómo evitar pruebas inestables.'),
  s('react-testing', 'ecc', 'Calidad y pruebas', 'Pruebas de componentes React con Testing Library, Vitest o Jest y MSW, incluida accesibilidad.'),
  s('browser-qa', 'ecc', 'Calidad y pruebas', 'Revisa en un navegador real que lo desplegado se vea y funcione bien.'),
  s('verification-loop', 'ecc', 'Calidad y pruebas', 'Antes de decir "terminé", verifica: compila, corre pruebas, revisa y confirma.'),
  s('coding-standards', 'ecc', 'Calidad y pruebas', 'Convenciones de código: nombres, legibilidad, inmutabilidad y revisión de calidad.'),
  s('accessibility', 'ecc', 'Diseño UI/UX', 'Accesibilidad WCAG 2.2 AA: teclado, contraste y lectores de pantalla, al diseñar y al revisar.'),
  // ECC: seguridad y devops
  s('security-review', 'ecc', 'Seguridad', 'Lista de seguridad para login, formularios, secretos, APIs y pagos.'),
  s('deployment-patterns', 'ecc', 'DevOps', 'Despliegues y CI/CD: Docker, chequeos de salud, vuelta atrás y lista para salir a producción.'),
  s('docker-patterns', 'ecc', 'DevOps', 'Dockerfiles y Docker Compose para desarrollo y producción, con seguridad y redes.'),
  s('git-workflow', 'ecc', 'DevOps', 'Flujo de git: ramas, mensajes de commit, merge o rebase y conflictos.'),
  s('github-ops', 'ecc', 'DevOps', 'GitHub con gh: issues, pull requests, CI y releases.'),
  // ECC: producto y documentación
  s('seo', 'ecc', 'Producto y contenido', 'SEO técnico y de contenido: metadatos, datos estructurados, Core Web Vitals y estrategia.'),
  s('product-lens', 'ecc', 'Producto y contenido', 'Valida el "para qué" antes de construir y pone a prueba la dirección del producto.'),
  s('brand-voice', 'ecc', 'Producto y contenido', 'Saca el estilo de escritura de textos reales y lo reutiliza para que todo suene igual.'),
  s('article-writing', 'ecc', 'Producto y contenido', 'Escribe artículos, guías y posts largos con una voz propia.'),
  s('codebase-onboarding', 'ecc', 'Documentación y equipo', 'Estudia un proyecto que no conoce y genera una guía: mapa de arquitectura, puntos de entrada y un CLAUDE.md.'),
  s('documentation-lookup', 'ecc', 'Documentación y equipo', 'Consulta la documentación actual de cada librería (vía Context7) en vez de fiarse de lo que recuerda.'),
  s('architecture-decision-records', 'ecc', 'Documentación y equipo', 'Deja por escrito cada decisión de arquitectura: contexto, alternativas y por qué se eligió.'),
  // Anthropic
  s('frontend-design', 'anthropic', 'Diseño UI/UX', 'Diseño visual con intención: tipografía y dirección estética para interfaces que no parezcan plantilla.'),
  s('webapp-testing', 'anthropic', 'Calidad y pruebas', 'Maneja un navegador con Playwright para probar una web local y sacar capturas.'),
  s('web-artifacts-builder', 'anthropic', 'Frontend', 'Páginas HTML completas con React, Tailwind y shadcn/ui.'),
  s('mcp-builder', 'anthropic', 'Backend y datos', 'Guía para escribir un servidor MCP propio que conecte una API con los agentes.'),
  s('theme-factory', 'anthropic', 'Diseño UI/UX', 'Aplica temas de color y tipografía a páginas, documentos o presentaciones.'),
  s('skill-creator', 'anthropic', 'Documentación y equipo', 'Crea una skill nueva contigo, pregunta a pregunta.'),
  s('claude-api', 'anthropic', 'Backend y datos', 'Guía oficial para programar con la API de Claude: modelos, herramientas y caché.'),
  s('pdf', 'anthropic', 'Documentación y equipo', 'Lee, une, divide, rellena y crea PDFs.'),
  s('xlsx', 'anthropic', 'Documentación y equipo', 'Hojas de cálculo con fórmulas, formato y gráficos.')
]

export function skillDelCatalogo(nombre: string): SkillCatalogo | undefined {
  return CATALOGO_SKILLS.find((x) => x.nombre === nombre)
}

/** Puesto de cada personaje en una oficina de software y web, con sus skills sugeridas. */
export const PUESTOS: Record<string, { puesto: string; skills: string[] }> = {
  michael: { puesto: 'Director del proyecto', skills: ['product-lens', 'verification-loop'] },
  dwight: { puesto: 'Backend y bases de datos', skills: ['backend-patterns', 'api-design', 'postgres-patterns', 'database-migrations', 'error-handling'] },
  jim: { puesto: 'Frontend (React y Next.js)', skills: ['frontend-patterns', 'react-patterns', 'nextjs-turbopack', 'react-performance'] },
  pam: { puesto: 'Diseño UI/UX', skills: ['ui-ux-pro-max', 'design-system', 'ui-styling', 'frontend-design'] },
  andy: { puesto: 'SEO y páginas de venta', skills: ['seo', 'banner-design', 'make-interfaces-feel-better'] },
  ryan: { puesto: 'Producto y crecimiento', skills: ['product-lens', 'seo'] },
  kelly: { puesto: 'Textos y contenido', skills: ['brand', 'brand-voice', 'article-writing'] },
  angela: { puesto: 'QA y pruebas', skills: ['tdd-workflow', 'e2e-testing', 'webapp-testing', 'react-testing', 'verification-loop'] },
  kevin: { puesto: 'Mantenimiento y tareas pequeñas', skills: ['coding-standards', 'git-workflow'] },
  oscar: { puesto: 'Arquitectura y revisión de código', skills: ['coding-standards', 'architecture-decision-records', 'error-handling', 'verification-loop'] },
  stanley: { puesto: 'Documentación', skills: ['codebase-onboarding', 'documentation-lookup'] },
  phyllis: { puesto: 'Accesibilidad', skills: ['accessibility', 'ui-ux-pro-max', 'make-interfaces-feel-better'] },
  creed: { puesto: 'DevOps y despliegues', skills: ['deployment-patterns', 'docker-patterns', 'github-ops'] },
  meredith: { puesto: 'Integraciones y APIs externas', skills: ['api-design', 'mcp-builder', 'error-handling'] },
  toby: { puesto: 'Seguridad', skills: ['security-review', 'error-handling'] }
}

/** Puesto por defecto de un personaje: el de software si lo tiene, si no el de la serie. */
export function puestoDe(personaje: string, rolSerie?: string): string | undefined {
  return PUESTOS[personaje]?.puesto ?? rolSerie
}

export function sugeridasPara(personaje: string): string[] {
  return PUESTOS[personaje]?.skills ?? []
}

export const NOMBRE_SKILL_VALIDO = /^[a-z0-9][a-z0-9._-]{0,63}$/
