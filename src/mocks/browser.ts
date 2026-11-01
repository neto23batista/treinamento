import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { socketHandlers } from './socket-handlers'

export const worker = setupWorker(...handlers, ...(import.meta.env.VITE_SOCKET_MOCK === 'true' ? socketHandlers : []))

