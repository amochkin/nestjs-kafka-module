export type TKafkaTopicName = string | RegExp;

export interface IKafkaTopic {
	name: TKafkaTopicName;
	subchannel?: string;
	userchannel?: string;
}

export type TKafkaTopics = IKafkaTopic[];
