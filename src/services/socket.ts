import type { Socket } from 'socket.io-client'

let socketPromise: Promise<Socket> | null = null

export const getSocket = () => {
  if (!socketPromise) {
    socketPromise = import('socket.io-client').then(({ io }) => io(import.meta.env.VITE_SOCKET_URL ?? 'http://127.0.0.1:3001', { autoConnect: false, reconnection: true }))
  }
  return socketPromise
}
