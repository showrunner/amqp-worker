const amqp = require('amqplib')

const rabbitMQHost = process.env.RABBIT_MQ_HOST || 'localhost'
const rabbitMQPort = process.env.RABBIT_MQ_PORT || 5672
const rabbitMQUser = process.env.RABBIT_MQ_USER || 'guest'
const rabbitMQPass = process.env.RABBIT_MQ_PASS || 'guest'

class QueueWorker {
  constructor (host, port, opts) {
    opts = opts || {}
    this.connection = void 0
    this.channel = void 0

    this.host = host || rabbitMQHost
    this.port = port || rabbitMQPort

    this.hostURL = `amqp://${rabbitMQUser}:${rabbitMQPass}@${this.host}:${this.port}/`
    this.listening = false
    this.assertOpts = opts.assertOpts || {}
    this.consumeOpts = opts.consumeOpts || {}
    this.sendOpts = opts.sendOpts || {}
  }

  async initialize () {
    if (!this.connection) {
      try {
        this.connection = await amqp.connect(this.hostURL)
      } catch (err) {
        return this._handleError(err)
      }
    }

    this.connection.on('error', (err) => {
      this._handleError(err)
    })

    return this.connection
  }

  async getChannel () {
    if (!this.connection) {
      await this.initialize()
    }

    if (!this.channel) {
      try {
        this.channel = await this.connection.createChannel()
      } catch (err) {
        this._handleError(err)
      }
    }

    return this.channel
  }

  async disconnect () {
    if (typeof this.beforeDisconnect === 'function') {
      await this.beforeDisconnect()
    }
    await this.channel.close()
    await this.connection.close()
    this.channel = void 0
    this.connection = void 0
  }

  serializeMessage (msg) {
    return msg
  }

  async messageHandler (msg) {
    throw new Error('You must implement this.messageHandler')
  }

  async sendMessage (msg, opts) {
    opts = opts || {}
    if (!this.channel && !opts.channel) {
      await this.getChannel()
    }

    const channel = opts.channel || this.channel
    const queue = opts.queue || this.queue
    const sendOpts = Object.assign({}, opts)
    delete sendOpts.queue
    delete sendOpts.channel

    return new Promise((resolve, reject) => {
      if (typeof this.queue !== 'string') {
        const err = new Error('You must specify a queue with this.queue')
        return reject(err)
      }

      const data = this.serializeMessage(msg)

      if (!Buffer.isBuffer(data)) {
        const err = new Error('msg must be a buffer')
        return reject(err)
      }

      const options = Object.assign({}, this.sendOpts, sendOpts)
      channel.sendToQueue(queue, data, options)
      resolve()
    })
  }

  async listen (assertOpts, consumeOpts) {
    if (this.listening) {
      throw new Error(`A listener for ${this.queue} has already been attached`)
    }

    if (typeof this.queue !== 'string' || this.queue.length < 1) {
      throw new Error('You must specify a queue with this.queue')
    }

    assertOpts = Object.assign({}, this.assertOpts, assertOpts)
    consumeOpts = Object.assign({}, this.consumeOpts, consumeOpts)

    await this.getChannel()
    await this.channel.assertQueue(this.queue, assertOpts)
    const consumer = await this.channel.consume(this.queue, (msg) => this.messageHandler(msg), consumeOpts)
    this.listening = true
    return consumer
  }

  _handleError (err) {
    if (typeof this.handleError === 'function') {
      this.handleError(err)
    } else {
      throw err
    }
  }
}

module.exports = QueueWorker
