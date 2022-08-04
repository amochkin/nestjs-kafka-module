import { Injectable, Logger } from '@nestjs/common';
import { Admin, Consumer, Kafka, logCreator, LogEntry, logLevel, Producer, ProducerRecord } from 'kafkajs';
import { p, v } from '@xorde-labs/log-utils';
import { KafkaMessageExt, MessagePayload } from './interfaces/message';
import { kafkaConfig } from './config/config';
import { EKafkaStatus } from './kafka.enum';
import { IKafkaTopicConsumerOptions, KafkaDecoratorsInterface, TKafkaTopicHandlers } from './kafka.decorator';
import { EventEmitter } from 'events';

class KafkaStatus {
	consumer: EKafkaStatus = EKafkaStatus.DISCONNECTED;
	producer: EKafkaStatus = EKafkaStatus.DISCONNECTED;
	admin: EKafkaStatus = EKafkaStatus.DISCONNECTED;
}

export class EventService extends EventEmitter {
	protected readonly logger = new Logger(this.constructor.name);
}

@Injectable()
export class KafkaService extends EventService {
	private readonly config = kafkaConfig().kafka;
	private topicHandlers: TKafkaTopicHandlers = KafkaDecoratorsInterface.handlers;
	private kafkaStatus: KafkaStatus = new KafkaStatus();
	private kafka: Kafka;
	private consumer: Consumer;
	private producer: Producer;
	private admin: Admin;
	errors = 0;

	private logError(entry: LogEntry, level: number) {
		this.logger.error(`${entry.label}-${level} [Kafka:${entry.namespace}] ${entry.log.message}`);
		this.errors++;
	}

	private logCreator: logCreator = (level: logLevel) => {
		switch (level) {
			case logLevel.ERROR:
				return (entry: LogEntry) => {
					this.logError(entry, level);
				};
			default:
				return (entry: LogEntry) => {
					if (entry.label == 'ERROR') {
						this.logError(entry, level);
					} else {
						this.logger.verbose(`${entry.label}-${level} [Kafka:${entry.namespace}] ${entry.log.message}`);
					}
				};
		}
	};

	/* Modification of standard emitter to allow user to subscribe to all events emitted by subscribing to "*" */
	emit(type: string | symbol, ...args: MessagePayload[]) {
		super.emit('*', ...args);
		return super.emit(type, ...args) || super.emit('', ...args);
	}

	/* Modification of standard subscriber to allow user to subscribe to kafka topic based on event name */
	on(topic: string | symbol, handler: (payload: MessagePayload) => void, options?: IKafkaTopicConsumerOptions): this {
		super.on(topic, handler);
		if (typeof topic == 'string' && topic != '*') {
			const topicHandler = { topic, handler, options };
			this.subscribe([topicHandler], true);
			this.topicHandlers.push(topicHandler);
		} else {
			this.logger.error('RegExp (and other topic name types) are not yet supported');
		}
		return this;
	}

	private async run() {
		await this.consumer.run({
			eachMessage: async (payload: MessagePayload) => this.handleMessage(payload),
		});
	}

	constructor() {
		super();
		this.logger.log('Topics: ' + v(this.topicHandlers.map((m) => m.topic)));

		KafkaDecoratorsInterface.instance = this;

		this.kafka = new Kafka({
			logCreator: this.logCreator as logCreator,
			...this.config.client,
		});

		this.admin = this.kafka.admin();

		this.consumer = this.kafka.consumer({
			...this.config.consumer,
		});

		this.consumer.on('consumer.connect', () => (this.kafkaStatus.consumer = EKafkaStatus.CONNECTED));
		this.consumer.on('consumer.crash', () => (this.kafkaStatus.consumer = EKafkaStatus.ERROR));
		this.consumer.on('consumer.disconnect', () => (this.kafkaStatus.consumer = EKafkaStatus.DISCONNECTED));

		this.producer = this.kafka.producer();

		this.producer.on('producer.connect', () => {
			this.logger.log('Producer connected');
			this.kafkaStatus.producer = EKafkaStatus.CONNECTED;
		});
		this.producer.on('producer.disconnect', () => (this.kafkaStatus.producer = EKafkaStatus.DISCONNECTED));
	}

	async onModuleInit() {
		try {
			this.kafkaStatus.producer = EKafkaStatus.CONNECTING;
			await this.producer.connect();
			this.kafkaStatus.producer = EKafkaStatus.CONNECTED;
		} catch (e) {
			this.kafkaStatus.producer = EKafkaStatus.ERROR;
			this.logger.error(e);
			this.errors++;
		}

		try {
			this.kafkaStatus.consumer = EKafkaStatus.CONNECTING;
			await this.consumer.connect();
			this.kafkaStatus.consumer = EKafkaStatus.CONNECTED;
			this.topicHandlers.map((m) => {
				if (typeof m.topic == 'string') super.on(m.topic, m.handler);
			});
			await this.subscribe(this.topicHandlers);
			await this.run();
		} catch (e) {
			this.kafkaStatus.consumer = EKafkaStatus.ERROR;
			this.logger.error(e);
			this.errors++;
		}

		try {
			this.kafkaStatus.admin = EKafkaStatus.CONNECTING;
			await this.admin.connect();
			this.kafkaStatus.admin = EKafkaStatus.CONNECTED;
		} catch (e) {
			this.kafkaStatus.admin = EKafkaStatus.ERROR;
			this.logger.error(e);
			this.errors++;
		}
	}

	async subscribe(topicHandlers: TKafkaTopicHandlers, runtime = false) {
		this.logger.debug(`Subscribing to array of topics: ${v(topicHandlers.map((m) => m.topic))}`);
		const consumerConnected = this.kafkaStatus.consumer == EKafkaStatus.CONNECTED;
		if (this.consumer) {
			try {
				if (consumerConnected) await this.consumer.stop();
				// filter out topics with empty name, and those that do not exist in this.topicHandlers array
				const handlers = topicHandlers.filter(
					(f) => !!f && this.topicHandlers.filter((f2) => f2.topic === f.topic).length != 0,
				);

				const existingTopics = await this.admin.listTopics();
				this.logger.debug(`Existing topics: ${v(existingTopics)}`);

				for (const handler of handlers) {
					this.logger.log(`Subscribing to topic ${runtime ? '[runtime]' : '[decorator]'}: ${handler.topic}`);
					if (typeof handler.topic === 'string' && existingTopics.includes(handler.topic)) {
						await this.consumer.subscribe({ topic: handler.topic, fromBeginning: handler.options?.fromBeginning });
					} else {
						this.logger.error(`Topic does not exist. Can not subscribe: ${handler.topic}`);
					}
				}
			} catch (e) {
				this.logger.error(`Subscribe error ${e}`);
				this.errors++;
			} finally {
				if (consumerConnected) await this.run();
			}
			return true;
		} else {
			this.logger.error(`Can't subscribe to ${v(topicHandlers)} due to consumer not initialized`);
			return false;
		}
	}

	private handleMessage(payload: MessagePayload) {
		/* Convert value buffer type to object type or string type */
		try {
			payload.message.value = JSON.parse(payload.message.value.toString());
		} catch (e) {
			payload.message.value = payload.message.value ? payload.message.value.toString() : null;
		}

		/* Convert key buffer type to object type or string type: */
		try {
			payload.message.key = JSON.parse(payload.message.key.toString());
		} catch (e) {
			payload.message.key = payload.message.key ? payload.message.key.toString() : null;
		}

		this.logger.verbose('Message: ' + v(p(payload, ['topic', 'message.key', 'message.timestamp'])));

		this.emit(payload.topic.toString(), payload);
	}

	/**
	 * Sends a message to specified Kafka topic
	 * @param topic Topic name
	 * @param message Message
	 */
	async send(topic: string, message: KafkaMessageExt) {
		message.key = message.key ? Buffer.from(JSON.stringify(message.key)) : null;
		message.value = Buffer.from(JSON.stringify(message?.value));
		message.headers = { ...message.headers, src: '@xorde-labs/nestjs-kafka-module' };

		const record: ProducerRecord = {
			topic,
			messages: [message],
		};
		await this.producer.send(record);
		return message;
	}

	/**
	 *
	 * @return {boolean} Returns `true` is consumer and producer are connected, otherwise returns `false`
	 */
	isConnected(): boolean {
		return this.kafkaStatus.consumer == EKafkaStatus.CONNECTED && this.kafkaStatus.producer == EKafkaStatus.CONNECTED;
	}

	/**
	 * Status reporting method for @xorde-labs/nestjs-status-module
	 */
	getStatus() {
		const status = this.isConnected()
			? 'OPERATIONAL'
			: this.kafkaStatus.consumer == EKafkaStatus.ERROR || this.kafkaStatus.producer == EKafkaStatus.ERROR
			? 'FAILED'
			: 'INTERMEDIARY';
		return {
			status,
			errors: this.errors,
			message: '',
		};
	}
}
