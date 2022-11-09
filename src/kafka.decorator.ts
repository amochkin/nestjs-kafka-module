/**
 * Decorator as another convenient way to subscribe to Kafka topics
 */

import { EachMessagePayload } from 'kafkajs';
import { TKafkaTopicName } from './interfaces/IKafkaTopic';
import { KafkaService } from './kafka.service';
import { KafkaMessageExt } from './interfaces/IMessagePayload';

export interface IKafkaTopicConsumerOptions {
	fromBeginning: boolean;
}

export interface IKafkaTopicHandler {
	topic: TKafkaTopicName;
	handler(message: EachMessagePayload): void;
	options?: IKafkaTopicConsumerOptions;
}

export type TKafkaTopicHandlers = IKafkaTopicHandler[];

export class KafkaDecoratorsInterface {
	static handlers: TKafkaTopicHandlers = [];
	static instance: KafkaService;
}

/**
 * Topic consumer decorator
 * @param topic
 * @param options
 * @constructor
 */
export const KafkaTopicConsumer = (topic: TKafkaTopicName, options?: IKafkaTopicConsumerOptions) => {
	return (target: any, key: string, descriptor: PropertyDescriptor) => {
		const handler = descriptor.value;
		if (typeof handler === 'function') KafkaDecoratorsInterface.handlers.push({ topic, handler, options });
	};
};

export interface IKafkaTopicProducerOptions {
	rawReturnType?: boolean;
	extractKeyProperty?: string;
}

/**
 *
 * @param topic
 * @param options
 * @constructor
 */
export const KafkaTopicProducer = (topic: string, options?: IKafkaTopicProducerOptions) => {
	return (target: any, key: string, descriptor: PropertyDescriptor) => {
		const fn = descriptor.value;

		/**
		 * target - class prototype
		 * key - method name
		 * descriptor - method handler
		 */

		if (fn.constructor.name === 'AsyncFunction') {
			descriptor.value = async function (...args: any) {
				const result = await fn?.apply(this, args);
				if (result && KafkaDecoratorsInterface.instance) {
					let message: KafkaMessageExt;
					if (options?.rawReturnType) {
						message = { value: result };
					} else {
						message = result;
					}

					if (options?.rawReturnType && options.extractKeyProperty) {
						message.key = result[options.extractKeyProperty];
					}

					await KafkaDecoratorsInterface.instance.send(topic, message);
				}
				return result;
			};
		} else if (fn.constructor.name === 'Function') {
			console.error('KafkaTopicProducer method decorator is not implemented for non-async methods');
		}

		return descriptor;
	};
};
