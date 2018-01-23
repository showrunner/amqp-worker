const test = require('tap').test
const proxyquire = require('proxyquire')

const channelProxy = {
  close () {},
  async assertQueue (queue, listener) {},
  async consume (queue, handler, opts) {}
}

const connectProxy = {
  async createChannel () {
    return new Promise((resolve) => resolve(channelProxy))
  },
  on () {},
  close () {}
}

const rabbitProxy = {
  async connect () {
    return new Promise((resolve) => resolve(connectProxy))
  }
}

const QueueWorker = proxyquire('../', {amqplib: rabbitProxy})

test('connection', async (t) => {
  const worker = new QueueWorker()
  worker.handleError = () => t.fail('should have no errors')
  await worker.initialize()
  t.pass('zero errors')
  t.end()
}).catch(test.threw)
