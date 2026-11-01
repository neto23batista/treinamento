import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'

const socketLink = ws.link('ws://127.0.0.1:3001/socket.io/')

export const socketHandlers = [socketLink.addEventListener('connection', (connection) => {
  const { client, server } = toSocketIo(connection)
  client.on('demo:nft-update', (_event, payload) => server.emit('nft.updated', payload))
  client.on('demo:order-update', (_event, payload) => server.emit('order.updated', payload))
})]

