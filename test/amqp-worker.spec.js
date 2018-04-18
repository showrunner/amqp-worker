const test = require('tap').test
const Events = require('events')
const proxyquire = require('proxyquire')

const channelProxy = {
  async close () {},
  async assertQueue (queue, opts) {},
  async consume (queue, handler, opts) {
    return {consumerTag: 'foo'}
  },
  sendToQueue (queue, data, opts) {}
}

const connectProxy = {
  async createChannel () {
    return new Promise((resolve) => resolve(channelProxy))
  },
  on () {},
  async close () {}
}

const rabbitProxy = {
  async connect () {
    return new Promise((resolve) => resolve(connectProxy))
  }
}

const QueueWorker = proxyquire('../', {amqplib: rabbitProxy})

test('failed connection', async (t) => {
  t.plan(1)
  const oldConnect = rabbitProxy.connect
  rabbitProxy.connect = async function () {
    return new Promise((resolve, reject) => {
      rabbitProxy.connect = oldConnect
      reject(new Error('foobar'))
    })
  }

  const worker = new QueueWorker()
  worker.handleError = () => t.pass('should have handled error')
  await worker.initialize()
}).catch(test.threw)

test('override host/port', async (t) => {
  const worker = new QueueWorker('localhost', 5672)
  worker.handleError = () => t.fail('should have no errors')
  await worker.initialize()
  t.pass('zero errors')
  t.end()
}).catch(test.threw)

test('provide override options', async (t) => {
  const opts = {
    assertOpts: {
      durable: true
    },
    consumeOpts: {
      exclusive: true
    },
    sendOpts: {
      persistent: true
    }
  }

  const oldConsume = channelProxy.consume
  const oldAssert = channelProxy.assertQueue
  const oldSend = channelProxy.sendToQueue

  channelProxy.consume = async function (queue, handler, opts) {
    channelProxy.consume = oldConsume
    t.deepEqual(opts, {exclusive: true}, 'exclusive')
    return {consumerTag: 'foo'}
  }

  channelProxy.assertQueue = async function (queue, opts) {
    channelProxy.assertQueue = oldAssert
    t.deepEqual(opts, {durable: true}, 'so durable')
  }

  channelProxy.sendToQueue = function (queue, data, opts) {
    channelProxy.sendToQueue = oldSend
    t.deepEqual(opts, {persistent: true}, 'never the less she persisted')
  }

  class TestWorker extends QueueWorker {
    constructor (host, port, opts) {
      super(host, port, opts)
      this.queue = 'test-queue'
    }

    messageHandler () {}

    handleError () {
      t.fail('should not fire')
    }
  }

  const worker = new TestWorker('localhost', 5672, opts)
  await worker.initialize()
  await worker.getChannel()
  await worker.listen()
  await worker.sendMessage(Buffer.from('test', 'utf8'))

  t.pass('zero errors')
  t.end()
}).catch(test.threw)

test('connection', async (t) => {
  const worker = new QueueWorker()
  worker.handleError = () => t.fail('should have no errors')
  await worker.initialize()
  t.pass('zero errors')
  t.end()
}).catch(test.threw)

test('connection but i got one', async (t) => {
  const oldConnect = rabbitProxy.connect
  let _count = 0
  rabbitProxy.connect = async function () {
    _count++
    rabbitProxy.connect = oldConnect
    return new Promise((resolve) => {
      resolve(connectProxy)
    })
  }
  const worker = new QueueWorker()
  worker.handleError = () => t.fail('should have no errors')
  await worker.initialize()
  t.equal(_count, 1, 'should i have one')
  await worker.initialize()
  t.equal(_count, 1, 'should be one still')
  t.end()
}).catch(test.threw)

test('connection error handler', async (t) => {
  t.plan(1)
  const emitter = new Events()
  const oldOn = connectProxy.on
  connectProxy.on = (evt, handle) => {
    connectProxy.on = oldOn
    emitter.on(evt, handle)
  }

  const worker = new QueueWorker()
  worker.handleError = (err) => t.equal(err.message, 'foo', 'error handled')
  await worker.initialize()
  emitter.emit('error', new Error('foo'))
}).catch(test.threw)

test('no error handler', async (t) => {
  t.plan(1)
  const emitter = new Events()
  const oldOn = connectProxy.on
  connectProxy.on = (evt, handle) => {
    connectProxy.on = oldOn
    emitter.on(evt, handle)
  }

  const worker = new QueueWorker()
  await worker.initialize()
  try {
    emitter.emit('error', new Error('foo'))
  } catch (err) {
    t.equal(err.message, 'foo')
  }
}).catch(test.threw)

test('get channel no init', async (t) => {
  const worker = new QueueWorker()
  worker.handleError = () => t.fail('no errars')
  await worker.getChannel()
  t.pass('connected and got channel')
  t.end()
}).catch(test.threw)

test('get channel', async (t) => {
  const worker = new QueueWorker()
  worker.handleError = () => t.fail('no errars')
  await worker.initialize()
  await worker.getChannel()
  t.pass('connected and got channel')
  t.end()
}).catch(test.threw)

test('get channel with an error', async (t) => {
  t.plan(1)

  const oldCreate = connectProxy.createChannel
  connectProxy.createChannel = async function () {
    connectProxy.createChannel = oldCreate
    throw new Error('bar')
  }

  const worker = new QueueWorker()
  worker.handleError = (err) => t.equal(err.message, 'bar', 'broken')
  await worker.getChannel()
}).catch(test.threw)

test('get channel when channel gotten', async (t) => {
  const worker = new QueueWorker()

  let _count = 0
  const oldCreate = connectProxy.createChannel
  connectProxy.createChannel = async function () {
    _count++
    return new Promise((resolve) => {
      connectProxy.createChannel = oldCreate
      resolve(channelProxy)
    })
  }

  worker.handleError = () => t.fail('no errars')
  await worker.initialize()
  await worker.getChannel()
  t.equal(_count, 1, 'got channel')
  await worker.getChannel()
  t.equal(_count, 1, 'got channel but did not call that thing')
  t.end()
}).catch(test.threw)

test('disconnect!', async (t) => {
  t.plan(4)
  const oldConnectClose = connectProxy.close
  connectProxy.close = async function () {
    connectProxy.close = oldConnectClose
    t.pass('called close on connect')
  }

  const oldChannelClose = channelProxy.close
  channelProxy.close = async function () {
    channelProxy.close = oldChannelClose
    t.pass('called close on channel')
  }

  const worker = new QueueWorker()
  await worker.getChannel()
  await worker.disconnect()
  t.ok(!worker.channel, 'channel gone')
  t.ok(!worker.connection, 'connection gone')
}).catch(test.threw)

test('before disconnect!', async (t) => {
  t.plan(5)
  const oldConnectClose = connectProxy.close
  connectProxy.close = async function () {
    connectProxy.close = oldConnectClose
    t.pass('called close on connect')
  }

  const oldChannelClose = channelProxy.close
  channelProxy.close = async function () {
    channelProxy.close = oldChannelClose
    t.pass('called close on channel')
  }

  const worker = new QueueWorker()
  worker.beforeDisconnect = async () => {
    t.pass('called before disconnect')
  }
  await worker.getChannel()
  await worker.disconnect()
  t.ok(!worker.channel, 'channel gone')
  t.ok(!worker.connection, 'connection gone')
}).catch(test.threw)

test('before disconnect not a function!', async (t) => {
  t.plan(4)
  const oldConnectClose = connectProxy.close
  connectProxy.close = async function () {
    connectProxy.close = oldConnectClose
    t.pass('called close on connect')
  }

  const oldChannelClose = channelProxy.close
  channelProxy.close = async function () {
    channelProxy.close = oldChannelClose
    t.pass('called close on channel')
  }

  const worker = new QueueWorker()
  worker.beforeDisconnect = true
  await worker.getChannel()
  await worker.disconnect()
  t.ok(!worker.channel, 'channel gone')
  t.ok(!worker.connection, 'connection gone')
}).catch(test.threw)

test('listen', async (t) => {
  t.plan(2)
  const oldConsume = channelProxy.consume
  channelProxy.consume = async function () {
    t.pass('obey, consume')
    channelProxy.consume = oldConsume
    return {consumerTag: 'foo'}
  }

  const worker = new QueueWorker()
  worker.queue = 'test-queue'
  worker.messageHandler = () => {}
  await worker.listen()
  t.equal(worker.consumerTag, 'foo', 'tag set')
}).catch(test.threw)

test('listen, already listening', async (t) => {
  t.plan(2)
  const oldConsume = channelProxy.consume
  channelProxy.consume = async function () {
    t.pass('obey, consume')
    channelProxy.consume = oldConsume
    return {consumerTag: 'foo'}
  }

  const worker = new QueueWorker()
  worker.queue = 'test-queue'
  worker.messageHandler = () => {}
  await worker.listen()
  try {
    await worker.listen()
  } catch (err) {
    t.equal(err.message, 'A listener for test-queue has already been attached')
  }
}).catch(test.threw)

test('listen, no handler', async (t) => {
  t.plan(1)
  const worker = new QueueWorker()
  worker.queue = 'test-queue'
  try {
    await worker.listen()
    await worker.messageHandler()
  } catch (err) {
    t.equal(err.message, 'You must implement this.messageHandler')
  }
}).catch(test.threw)

test('listen, no queue', async (t) => {
  t.plan(1)
  const worker = new QueueWorker()
  worker.messageHandler = () => {}
  try {
    await worker.listen()
  } catch (err) {
    t.equal(err.message, 'You must specify a queue with this.queue')
  }
}).catch(test.threw)

test('send to queue, no channel', async (t) => {
  t.plan(2)
  const oldSend = channelProxy.sendToQueue
  channelProxy.sendToQueue = function (queue, msg) {
    const data = msg.toString('utf8')
    t.equal(data, 'test', 'un-munged data')
    channelProxy.sendToQueue = oldSend
  }

  const worker = new QueueWorker()
  worker.queue = 'test-queue'
  worker.handleError = () => t.fail('should not fire')
  await worker.sendMessage(Buffer.from('test', 'utf8'))
  t.pass('resolved and sent')
}).catch(test.threw)

test('send to queue, no queue', async (t) => {
  t.plan(1)
  const worker = new QueueWorker()
  try {
    await worker.sendMessage(Buffer.from('test', 'utf8'))
  } catch (err) {
    t.equal(err.message, 'You must specify a queue with this.queue')
  }
}).catch(test.threw)

test('send to queue, not a buffer', async (t) => {
  t.plan(1)
  const worker = new QueueWorker()
  worker.queue = 'test-queue'
  worker.handleError = () => t.fail('should not fire')
  try {
    await worker.sendMessage('test', {})
  } catch (err) {
    t.equal(err.message, 'msg must be a buffer')
  }
}).catch(test.threw)

test('custom serialize', async (t) => {
  const oldSend = channelProxy.sendToQueue
  channelProxy.sendToQueue = function (queue, msg) {
    const data = msg.toString('utf8')
    t.equal(data, 'test', 'un-munged data')
    channelProxy.sendToQueue = oldSend
  }

  function TestWorker () {
    Object.assign(this, Reflect.construct(QueueWorker, arguments, TestWorker))
    this.queue = 'test-queue'
  }

  Object.setPrototypeOf(TestWorker.prototype, QueueWorker.prototype)

  TestWorker.prototype.serializeMessage = function (msg) {
    return Buffer.from(msg, 'utf8')
  }

  const worker = new TestWorker()
  await worker.sendMessage('test')
  t.pass('resolved and sent')
})
