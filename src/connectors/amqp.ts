import * as amqp from 'amqplib'
import { Connection, Channel } from 'amqplib'
import { RABBITMQ_URL } from '../config/env'

let connection: Connection | null = null
let channel: Channel | null = null

export async function getAmqpChannel(): Promise<Channel> {
  if (channel) {
    return channel
  }

  connection = await amqp.connect(RABBITMQ_URL, {
    timeout: 5000,
    heartbeat: 60,
    clientProperties: { connection_name: 'jurinorm' }
  })
  connection.once('error', () => { channel = null; connection = null })
  connection.once('close', () => { channel = null; connection = null })

  channel = await connection.createChannel()

  return channel
}

export async function closeAmqpConnection(): Promise<void> {
  try {
    await channel?.close()
  } finally {
    await connection?.close()
    channel = null
    connection = null
  }
}

