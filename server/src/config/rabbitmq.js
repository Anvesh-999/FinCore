import amqp from 'amqplib';
import EventEmitter from 'events';
import logger from '../middleware/logger.js';

class RabbitMQManager {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isFallback = false;
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  async connect() {
    try {
      const url = process.env.RABBITMQ_URL || 'amqp://localhost';
      logger.info(`Connecting to RabbitMQ at ${url}...`);
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      logger.info('Successfully connected to RabbitMQ broker');
      this.isFallback = false;
    } catch (err) {
      logger.warn(`RabbitMQ Broker connection failed: ${err.message}. Falling back to asynchronous in-memory queue.`);
      this.isFallback = true;
    }
  }

  async publishToQueue(queueName, message) {
    if (!this.isFallback && this.channel) {
      try {
        await this.channel.assertQueue(queueName, { durable: true });
        this.channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
          persistent: true,
        });
        return true;
      } catch (err) {
        logger.error(`Failed to publish message to RabbitMQ queue ${queueName}, switching to memory fallback:`, err);
      }
    }

    // Fallback in-memory behavior: trigger asynchronously after a delay to simulate execution time
    setTimeout(() => {
      const mockMsg = {
        content: Buffer.from(JSON.stringify(message)),
      };
      this.emitter.emit(queueName, mockMsg);
    }, 50);
    return true;
  }

  async consumeQueue(queueName, handler) {
    if (!this.isFallback && this.channel) {
      try {
        await this.channel.assertQueue(queueName, { durable: true });
        await this.channel.prefetch(1);
        await this.channel.consume(queueName, async (msg) => {
          if (msg !== null) {
            const channelMock = {
              ack: () => {
                try { this.channel.ack(msg); } catch (e) {}
              },
              nack: () => {
                try { this.channel.nack(msg); } catch (e) {}
              }
            };
            try {
              await handler(msg, channelMock);
            } catch (err) {
              logger.error(`Error processing RabbitMQ message from ${queueName}:`, err);
              try { this.channel.nack(msg); } catch (e) {}
            }
          }
        });
        return;
      } catch (err) {
        logger.error(`Failed to consume from RabbitMQ queue ${queueName}, switching to memory fallback:`, err);
      }
    }

    // Fallback in-memory behavior: register subscriber
    this.emitter.on(queueName, async (mockMsg) => {
      const channelMock = {
        ack: () => {},
        nack: () => {}
      };
      try {
        await handler(mockMsg, channelMock);
      } catch (err) {
        logger.error(`Error processing fallback message from ${queueName}:`, err);
      }
    });
  }
}

const rabbitMQManager = new RabbitMQManager();
export default rabbitMQManager;
