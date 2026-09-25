export type Peinado =
  | 'corto'
  | 'raya'
  | 'despeinado'
  | 'largo'
  | 'bob'
  | 'moño'
  | 'calvo'
  | 'calvoLados'
  | 'entradas'
  | 'rizado'

export type Prenda = 'camisa' | 'traje' | 'cardigan' | 'chaleco'

export interface Apariencia {
  piel: number
  pelo: number
  peinado: Peinado
  camisa: number
  prenda: Prenda
  /** Color del saco, cardigan o chaleco. */
  colorPrenda?: number
  mangasCortas?: boolean
  corbata?: number
  lentes?: boolean
  bigote?: number
  barba?: number
  boca?: 'sonrisa' | 'seria' | 'triste'
  complexion?: 'delgada' | 'normal' | 'gruesa'
  altura?: number
}

export interface Personaje {
  id: string
  nombre: string
  rol: string
  personalidad: string
  apariencia: Apariencia
}

export const ID_MICHAEL = 'michael'

export const REPARTO: Personaje[] = [
  {
    id: ID_MICHAEL,
    nombre: 'Michael Scott',
    rol: 'Gerente Regional',
    personalidad:
      'Quiere ser el jefe favorito y el amigo de todos; entusiasta, dramático y con chistes que a veces no caen bien.',
    apariencia: {
      piel: 0xf0c8a0,
      pelo: 0x3b2a20,
      peinado: 'corto',
      camisa: 0xf4f6f8,
      prenda: 'traje',
      colorPrenda: 0x343a48,
      corbata: 0x8a2433
    }
  },
  {
    id: 'dwight',
    nombre: 'Dwight Schrute',
    rol: 'Asistente del Gerente Regional',
    personalidad:
      'Intenso, competitivo y obsesionado con las reglas, la jerarquía y la eficiencia. Leal a Michael. Menciona su granja de remolachas y su entrenamiento de supervivencia.',
    apariencia: {
      piel: 0xf2cfae,
      pelo: 0x4a3322,
      peinado: 'raya',
      camisa: 0xd9b64a,
      prenda: 'camisa',
      mangasCortas: true,
      corbata: 0x5a4632,
      lentes: true,
      boca: 'seria',
      altura: 1.03
    }
  },
  {
    id: 'jim',
    nombre: 'Jim Halpert',
    rol: 'Representante de ventas',
    personalidad:
      'Relajado, ingenioso y con humor seco. Resuelve con pragmatismo y a veces le hace bromas a Dwight (nunca en el trabajo entregado).',
    apariencia: {
      piel: 0xf0c9a2,
      pelo: 0x5b3f2a,
      peinado: 'despeinado',
      camisa: 0xdfe9f4,
      prenda: 'camisa',
      corbata: 0x2c3e66,
      complexion: 'delgada',
      altura: 1.1
    }
  },
  {
    id: 'pam',
    nombre: 'Pam Beesly',
    rol: 'Recepcionista',
    personalidad: 'Amable, observadora y creativa (le encanta el arte). Comunica con claridad y buen gusto.',
    apariencia: {
      piel: 0xf3cfb0,
      pelo: 0xa0522d,
      peinado: 'largo',
      camisa: 0xf5efe6,
      prenda: 'cardigan',
      colorPrenda: 0xd98fa8,
      altura: 0.94
    }
  },
  {
    id: 'andy',
    nombre: 'Andy Bernard',
    rol: 'Representante de ventas',
    personalidad:
      'Entusiasta y con ganas de caer bien. Presume de haber estudiado en Cornell y canta a capela cuando está contento.',
    apariencia: {
      piel: 0xf2caa6,
      pelo: 0x8a6a45,
      peinado: 'corto',
      camisa: 0xf2b5a8,
      prenda: 'chaleco',
      colorPrenda: 0x2f4f7a,
      corbata: 0xb03a2e
    }
  },
  {
    id: 'ryan',
    nombre: 'Ryan Howard',
    rol: 'Temporal',
    personalidad: 'Ambicioso y obsesionado con las startups y la tecnología de moda. Propone ideas "disruptivas".',
    apariencia: {
      piel: 0xeec29a,
      pelo: 0x1f1a17,
      peinado: 'despeinado',
      camisa: 0x5b7fb0,
      prenda: 'camisa',
      corbata: 0x1f2a3a,
      complexion: 'delgada'
    }
  },
  {
    id: 'kelly',
    nombre: 'Kelly Kapoor',
    rol: 'Atención al cliente',
    personalidad: 'Parlanchina y expresiva, fan de la cultura pop y los chismes de la oficina.',
    apariencia: {
      piel: 0xc68c5e,
      pelo: 0x151515,
      peinado: 'largo',
      camisa: 0xe84393,
      prenda: 'camisa',
      complexion: 'delgada',
      altura: 0.93
    }
  },
  {
    id: 'angela',
    nombre: 'Angela Martin',
    rol: 'Jefa de contabilidad',
    personalidad: 'Estricta, perfeccionista y muy seria. No tolera el desorden. Adora a sus gatos.',
    apariencia: {
      piel: 0xf5d7bd,
      pelo: 0xe6cf8b,
      peinado: 'moño',
      camisa: 0xf3ecdc,
      prenda: 'cardigan',
      colorPrenda: 0xbfa78a,
      boca: 'seria',
      complexion: 'delgada',
      altura: 0.88
    }
  },
  {
    id: 'kevin',
    nombre: 'Kevin Malone',
    rol: 'Contador',
    personalidad: 'Tranquilo y sencillo; le encanta la comida (su chili es famoso). Explica con palabras simples.',
    apariencia: {
      piel: 0xf0c6a0,
      pelo: 0x6b5a4a,
      peinado: 'calvo',
      camisa: 0x3f5f8a,
      prenda: 'camisa',
      complexion: 'gruesa',
      altura: 1.04
    }
  },
  {
    id: 'oscar',
    nombre: 'Oscar Martinez',
    rol: 'Contador',
    personalidad: 'El más racional y culto de la oficina. Preciso, corrige errores con paciencia (y un poco de ironía).',
    apariencia: {
      piel: 0xd4a176,
      pelo: 0x1c1714,
      peinado: 'corto',
      camisa: 0xe9e4f0,
      prenda: 'chaleco',
      colorPrenda: 0x5d4a7a,
      corbata: 0x3a2f55,
      boca: 'seria'
    }
  },
  {
    id: 'stanley',
    nombre: 'Stanley Hudson',
    rol: 'Representante de ventas',
    personalidad: 'Directo, sin rodeos y sin paciencia para reuniones inútiles. Ama los crucigramas y el día del pretzel.',
    apariencia: {
      piel: 0x6e4428,
      pelo: 0x9a9a9a,
      peinado: 'calvoLados',
      camisa: 0xd8c7a3,
      prenda: 'camisa',
      corbata: 0x6b3e26,
      bigote: 0x8f8f8f,
      lentes: true,
      boca: 'seria',
      complexion: 'gruesa'
    }
  },
  {
    id: 'phyllis',
    nombre: 'Phyllis Vance',
    rol: 'Representante de ventas',
    personalidad: 'Dulce y maternal, teje en sus ratos libres. Esposa de Bob Vance, de Vance Refrigeration.',
    apariencia: {
      piel: 0xf2cdb0,
      pelo: 0xb8a48a,
      peinado: 'bob',
      camisa: 0xf0e6d8,
      prenda: 'cardigan',
      colorPrenda: 0x7fae8e,
      complexion: 'gruesa',
      altura: 0.95
    }
  },
  {
    id: 'creed',
    nombre: 'Creed Bratton',
    rol: 'Control de calidad',
    personalidad: 'Misterioso e impredecible, con un pasado turbio y comentarios extraños.',
    apariencia: {
      piel: 0xeec7a8,
      pelo: 0xd9d9d9,
      peinado: 'despeinado',
      camisa: 0x4b4f58,
      prenda: 'camisa',
      complexion: 'delgada'
    }
  },
  {
    id: 'meredith',
    nombre: 'Meredith Palmer',
    rol: 'Relaciones con proveedores',
    personalidad: 'Despreocupada, fiestera y sin ningún filtro.',
    apariencia: {
      piel: 0xf2cfb3,
      pelo: 0xc0392b,
      peinado: 'rizado',
      camisa: 0x2e8b57,
      prenda: 'camisa',
      altura: 0.95
    }
  },
  {
    id: 'toby',
    nombre: 'Toby Flenderson',
    rol: 'Recursos Humanos',
    personalidad: 'Tranquilo y algo melancólico. Vela por las normas y el bienestar del equipo, aunque Michael no lo soporte.',
    apariencia: {
      piel: 0xf0c8a4,
      pelo: 0x7a5a40,
      peinado: 'entradas',
      camisa: 0xe8eef3,
      prenda: 'chaleco',
      colorPrenda: 0xa89272,
      corbata: 0x4f5d6b,
      barba: 0x6d5039,
      boca: 'triste'
    }
  }
]

export function personajeDe(id: string): Personaje | undefined {
  return REPARTO.find((p) => p.id === id)
}
