# amqp-worker

[![Build Status](https://travis-ci.org/scriptoLLC/amqp-worker.svg?branch=master)](https://travis-ci.org/scriptoLLC/amqp-worker)

A class to use as a base for connecting and dealing with RabbitMQ.  Uses `async`
and `await` so it needs Node 8. This is mostly a convienence wrapper around
[amqplib](http://www.squaremobius.net/amqp.node/)

## Usage
```js
const QueueWorker = require('@scriptollc/queue-worker')
class MyWorker extends QueueWorker {
  constructor () {
    super()
    this.queue = 'my-queue'
  }

  messageHandler (msg) {
    const data = msg.content
    this.channel.ack(msg)
  }
}

const worker = new MyWorker()
worker.listen()
  .then(() => console.log('listening!'))
  .catch((err) => console.log('ERROR!', err)
```

or, if you wanna prototype this thing:

```js
const QueueWorker = require('@scriptollc/queue-worker')

function MyWorker () {
  QueueWorker.call(this)
  this.queue = 'my-queue'
}

MyWorker.prototype = Object.create(QueueWorker.prototype)

MyWorker.prototype.messageHandler = function (msg) {
  const data = msg.content
  this.channel.ack(msg)
}

const worker = new MyWorker()
worker.listen()
  .then(() => console.log('listening!'))
  .catch((err) => console.log('ERROR!', err)
```


## API

### new QueueWorker(host?:string, port?:number):QueueWorker
Create a new instance of a queue worker. Optionally pass in a hostname
and a port for the RabbitMQ server.  These may also be specified in environment
variables:

* `RABBIT_MQ_HOST` - default: `localhost`
* `RABBIT_MQ_POST` - default: `5672`

All queue worker instances must implement:

* `messageHandler(msg:object):undefined` - the message handler
* `queue:string` - the name of the queue

They may as well implement:

* `handleError(err:Error):undefined` - error handler (default: throws errors)
* `beforeDisconnect():Promise` - do something before disconnection

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

#### async QueueWorker#listen(listenOpts?:object, consumeOpts?:object):Promise
Assert the specified queue and attach the messageHandler as a queue consumer.

Will create a connection and/or a channel as necessary.  The options for `assertQueue`
and `consume` are the same as for the amqplib functions.

#### QueueWorker#messageHandler(msg:Object):undefined
**This MUST be implemented!**
Handle messages coming in from RabbitMQ.  The `msg` object is the same
as provided for the `consume` method in [amqplib](http://www.squaremobius.net/amqp.node/channel_api.html#channelconsume):

```json
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
