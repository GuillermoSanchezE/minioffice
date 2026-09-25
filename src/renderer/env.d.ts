/// <reference types="vite/client" />
import type { MiniofficeApi } from '../shared/api'

declare global {
  interface Window {
    minioffice: MiniofficeApi
  }
}

export {}
