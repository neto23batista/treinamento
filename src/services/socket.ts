import type { Socket } from 'socket.io-client'

let socketPromise: Promise<Socket> | null = null

export const getSocket = () => {
  if (!socketPromise) {
    socketPromise = import('socket.io-client').then(({ io }) => {
      const isMocked = import.meta.env.VITE_SOCKET_MOCK === 'true'
      const socketUrl = isMocked
        ? window.location.origin
        : (import.meta.env.VITE_SOCKET_URL ?? 'http://127.0.0.1:3001')
      return io(socketUrl, {
        autoConnect: false,
        reconnection: true,
        ...(isMocked ? { transports: ['websocket'] } : {}),
      })
    })
  }
  return socketPromise
}
