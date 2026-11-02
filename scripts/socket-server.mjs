import { createServer } from 'node:http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, { cors: { origin: '*' } })
let version = 0

io.on('connection', (socket) => {
  socket.emit('server.ready', { resource: 'demo', version })
  socket.on(
    'demo:nft-update',
    ({ nftId = 'emerald-ape-042', price = '1.27', stock = 8, eventVersion } = {}) => {
      const nextVersion = Number.isInteger(eventVersion) ? eventVersion : version + 1
      version = Math.max(version, nextVersion)
      io.emit('nft.updated', {
        resource: 'nft',
        resourceId: nftId,
        version: nextVersion,
        price: String(price),
        stock,
      })
    },
  )
  socket.on(
    'demo:order-update',
    ({ orderId = '0xA91F…E82C', status = 'confirmed', userId = 'guest', eventVersion } = {}) => {
      const nextVersion = Number.isInteger(eventVersion) ? eventVersion : version + 1
      version = Math.max(version, nextVersion)
      io.emit('order.updated', {
        resource: 'order',
        resourceId: orderId,
        version: nextVersion,
        status,
        userId,
      })
    },
  )
})

httpServer.listen(3001, '127.0.0.1', () =>
  console.log('Kurio mock Socket.IO listening on http://127.0.0.1:3001'),
)
