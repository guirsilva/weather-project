import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class WeatherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WeatherService.name);
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private queueName = 'local_weather';
  private lastMessage: any = null;

  async onModuleInit() {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL as string;
      this.connection = await amqp.connect(rabbitmqUrl);

      this.channel = await this.connection.createChannel();
      await this.channel.assertQueue(this.queueName, { durable: true });

      this.channel.consume(this.queueName, (msg) => {
        if (msg) {
          try {
            const content = msg.content.toString();

            this.lastMessage = JSON.parse(content);

            this.channel.ack(msg);
          } catch (parseErr) {
            this.channel.nack(msg, false, true);
          }
        }
      });
    } catch (err) {
      this.logger.error('RabbitMQ connection error:', err.message);
    }
  }

  getLastMessage() {
    return this.lastMessage;
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}