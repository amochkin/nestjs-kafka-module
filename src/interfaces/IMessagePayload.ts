import { EachMessagePayload, IHeaders } from 'kafkajs';

export interface IMessagePayload extends Omit<EachMessagePayload, 'message'> {
	topic: string;
	partition: number;
	message: KafkaMessageExt;
	userchannel?: string;
	subchannel?: string;
}

export type KafkaMessageExt = {
	key?: any;
	value: any;
	timestamp?: string;
	size?: number;
	attributes?: number;
	offset?: string;
	headers?: IHeaders;
};

export const simpleKafkaMessage = (value: any, key?: any, headers?: any): KafkaMessageExt => {
	return { value, key, headers };
};
