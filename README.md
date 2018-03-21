# amqp-worker

[![Build Status](https://travis-ci.org/scriptoLLC/amqp-worker.svg?branch=master)](https://travis-ci.org/scriptoLLC/amqp-worker)

A base worker class for connecting to and dealing with RabbitMQ.

This is mostly a convenience wrapper around [amqplib](http://www.squaremobius.net/amqp.node/).

## Install

### Requirements

- [Node.js](https://nodejs.org/en/download/) 8+ (for `async/await`)
- [RabbitMQ](https://www.rabbitmq.com/)

```
npm install @scriptollc/amqp-worker
```

## Usage

```js
const QueueWorker = require('@scriptollc/amqp-worker')

class MyWorker extends QueueWorker {
  constructor () {
    super()
    this.queue = 'my-queue'
  }

  messageHandler (msg) {
    const data = msg.content
    this.channel.ack(data)
  }
}

const worker = new MyWorker()

worker.listen()
  .then(() => console.log('listening!'))
  .catch((err) => console.log('ERROR!', err))
```

If you're not into ES6 Classes, you can use a function and the prototype chain
to manage this as well. Since this is an ES6 class however, prototyping
requires the use of `Reflect`:

```js
const QueueWorker = require('@scriptollc/amqp-worker')

function MyWorker () {
  Object.assign(this, Reflect.construct(QueueWorker, arguments, MyWorker))
  this.queue = 'my-queue'
}

Reflect.setPrototypeOf(MyWorker.prototype, QueueWorker.prototype)

MyWorker.prototype.messageHandler = function (msg) {
  const data = msg.content
  this.channel.ack(data)
}

const worker = new MyWorker()
worker.listen()
  .then(() => console.log('listening!'))
  .catch((err) => console.log('ERROR!', err))
```

The upside to this construct is that it works for both ES6 style classes
and traditional JS function prototypes.

## API

### new QueueWorker(host?:string, port?:number, opts?:object):QueueWorker
Create a new instance of a queue worker. Optionally pass in a hostname
and a port for the RabbitMQ server.  These may also be specified in environment
variables:

* `RABBIT_MQ_HOST` - default: `localhost`
* `RABBIT_MQ_POST` - default: `5672`

An object of objects may be passed in to provide default options for asserting
a queue, consuming a queue or sending a message to a queue. Options may be
overridden or additional options may be provided at runtime

* `opts.assertOpts` - default options for `this.channel.assertQueue`
* `opts.consumeOpts` - default options for `this.channel.consume`
* `opts.sendOpts` - default options for `this.channel.sendToQueue`

All queue worker instances must implement:

* `messageHandler(msg:object):undefined` - the message handler
* `queue:string` - the name of the queue

They may as well implement:

* `handleError(err:Error):undefined` - error handler (default: throws errors)
* `beforeDisconnect():Promise` - do something before disconnection
* `serializeMessage():Buffer` - called on the msg passed in to `sendMessage`.
    noop by default, allows you to control how messages get changed into Buffers

### Methods
#### async QueueWorker#initialize():Promise
Connect to the specified RabbitMQ server and attach a listener for error
messages on the connection

#### async QueueWorker#getChannel():Promise
Create a channel on the active connection, or, make a connection if one doesn't
exist and create a channel

#### async QueueWorker#disconnect():Promise
Disconnect the channel and the server, running the optional `beforeDisconnect`
handler.

#### async QueueWorker#listen(assertOpts?:object, consumeOpts?:object):Promise
Assert the specified queue and attach the messageHandler as a queue consumer.

Will create a connection and/or a channel as necessary.  The options for `assertQueue`
and `consume` are the same as for the amqplib functions.

#### async QueueWorker#sendMessage(msg:Buffer|Any, sendOpts?object):Promise
Send a message to the queue, using the specified options, if any.  Your message
must either be an instance of the Buffer object, or you must have overridden
`QueueWorker#serializeMessage` to return a Buffer.

You may use a different channel to send a message to a queue by passing in a `channel`
key on the `sendOpts` object.

#### QueueWorker#messageHandler(msg:Object):undefined
**This MUST be implemented!**
Handle messages coming in from RabbitMQ.  The `msg` object is the same
as provided for the `consume` method in [amqplib](http://www.squaremobius.net/amqp.node/channel_api.html#channelconsume):

```js
{
  content: Buffer,
  fields: Object,
  properties: Object
}
```

You can use `this.channel.ack` and `this.channel.nack` (or any of the channel
methods) to tell the server you've handled (or rejected) the message.

#### async QueueWorker#beforeDisconnect():Promise
**This MAY be implemented**

Do something before disconnecting the channel and the connecftion

#### async QueueWorker#handleError(err:Error):undefined
**This MAY be implemented**

Do something with any errors that might be thrown

### Properties
#### QueueWorker.queue:string
What queue to use when asserting


## License
Copyright © 2018, Scripto LLC. Apache-2.0 licensed.
