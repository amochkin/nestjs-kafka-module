import { ConsumerConfig, KafkaConfig } from 'kafkajs';
import { kafkaDefaults } from './defaults';

export interface ExtendedKafkaOptions {
	client: KafkaConfig;
	consumer: ConsumerConfig;
}

export interface IKafkaOptions {
	kafka: ExtendedKafkaOptions;
}

export const kafkaConfig = (): IKafkaOptions => ({
	kafka: {
		consumer: {
			groupId: process.env.KAFKA_GROUP_ID ?? kafkaDefaults.KAFKA_GROUP_ID,
		},
		client: {
			clientId: process.env.KAFKA_CLIENT_ID,
			brokers: process.env.KAFKA_BROKERS?.split(',') ?? [],
			ssl: process.env.KAFKA_SSL === 'true',
			sasl:
				process.env.KAFKA_SASL === 'true'
					? {
							mechanism: 'plain',
							username: process.env.KAFKA_USERNAME ?? '',
							password: process.env.KAFKA_PASSWORD ?? '',
					  }
					: undefined,
		},
	},
});
