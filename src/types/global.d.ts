import type { NexTermApi } from '@shared/api'

declare global {
  interface Window {
    nexterm: NexTermApi
  }
}

export {}
