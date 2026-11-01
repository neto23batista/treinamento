import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
// MSW strips Socket.IO's `/socket.io/` prefix before matching the WebSocket URL.
const socketLink = ws.link(`${protocol}//${window.location.host}`)

export const socketHandlers = [socketLink.addEventListener('connection', (connection) => {
  const { client, server } = toSocketIo(connection)
  client.on('demo:nft-update', (_event, payload) => server.emit('nft.updated', payload))
  client.on('demo:order-update', (_event, payload) => server.emit('order.updated', payload))
})]

