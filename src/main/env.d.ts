/// <reference types="electron-vite/node" />

interface ImportMetaEnv {
  /** Compilación para las pruebas automáticas: la app instalada acepta el depurador remoto. */
  readonly MAIN_VITE_PRUEBAS?: string
  /** La app se firma con un Developer ID: las claves van al Llavero. */
  readonly MAIN_VITE_FIRMADA?: string
}
