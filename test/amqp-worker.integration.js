const test = require('tap').test
const crypto = require('crypto')

const QueueWorker = require('../')

test('send and listen', (t) => {
  t.plan(1)
  return new Promise(async (resolve, reject) => {
    const worker = new QueueWorker()
    const queue = crypto.randomBytes(4).toString('hex')

    worker.queue = queue

    worker.messageHandler = async (msg) => {
      if (!msg) return
      const data = msg.content.toString('utf8')
      t.equal(data, 'hello world', 'decode')
      await worker.channel.purgeQueue(queue)
      await worker.channel.deleteQueue(queue)
      await worker.disconnect()
      resolve()
    }

    await worker.listen()
    try {
      const msg = Buffer.from('hello world')
      await worker.sendMessage(msg)
    } catch (err) {
      t.fail(err)
      reject(err)
    }
  })
}).catch(test.threw)
