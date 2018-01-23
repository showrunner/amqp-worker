const amqp = require('amqplib')

const rabbitMQHost = process.env.RABBIT_MQ_HOST || 'localhost'
const rabbitMQPort = process.env.RABBIT_MQ_PORT || 5672

const HOST_SYM = Symbol('host')
const LISTENING_SYM = Symbol('listening')
const LISTEN_OPTS_SYM = Symbol('listenOpts')
const CONSUME_OPTS_SYM = Symbol('consumeOpts')

class QueueWorker {
  constructor () {
    this.connection = void 0
    this.channel = void 0
    this.queue = ''

    this[HOST_SYM] = `amqp://${rabbitMQHost}:${rabbitMQPort}/`
    this[LISTENING_SYM] = false
    this[LISTEN_OPTS_SYM] = {
      durable: true
    }
    this[CONSUME_OPTS_SYM] = {}
  }

  async initialize () {
    if (!this.connection) {
      try {
        this.connection = await amqp.connect(this._host)
      } catch (err) {
        this._handleError(err)
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

  async listen (listenOpts, consumeOpts) {
    if (this[LISTENING_SYM]) {
      throw new Error(`A listener for ${this.queue} has already been attached`)
    }

    if (typeof this.messageHandler !== 'function') {
      throw new Error('You must implement this.handler')
    }

    listenOpts = Object.assign({}, this[LISTEN_OPTS_SYM], listenOpts)
    consumeOpts = Object.assign({}, this[CONSUME_OPTS_SYM], consumeOpts)

    await this.getChannel()
    await this.channel.assertQueue(this.queue, listenOpts)
    return this.channel.consume(this.queue, this.handler, consumeOpts)
  }

  _handleError (err) {
    if (typeof this.handleError === 'function') {
      this.handleError(err)
    }
  }
}

module.exports = QueueWorker
