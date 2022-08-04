# Package @xorde-labs/nestjs-kafka-module


[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

Kafka Module for NestJs with extended features

## Subscribing to Kafka topics

### Topic names

Topic name is an alphanumeric string (0..9, A..Z, a..z), with allows symbols: `-` (hyphen), `_` (underscore), `.` (dot)

This module also allows subscribers to use special topic name `*` that will receive messages from all implicitly (by providing topic exact topic name) subscribed topics.

#### Topic naming convention

https://devshawn.com/blog/apache-kafka-topic-naming-conventions/


### Decorator

Example:

```typescript
import { KafkaMessage } from 'kafkajs';
import { KafkaTopicSubscriber } from './kafka.decorator';

@Injectable()
export class ExampleService {
	constructor() {
	}

	@KafkaTopicSubscriber('topic-name')
	messageHandler(message: KafkaMessage) {
		console.log(message);
	}
}
```

> You can only use run-time constants as topic names. If you want to provide topic names dynamically (eg. using config parameters), then you need to use runtime event emitter method as described below.

### Runtime event emitter

Example:

```typescript
import { KafkaMessage } from 'kafkajs';
import { KafkaService } from './kafka.service';

@Injectable()
export class ExampleService {
	constructor(
		private kafka: KafkaService,
	) {
	}

	async onModuleInit() {
		this.kafka.on('topic-name', this.messageHandler);
	}

	messageHandler(message: KafkaMessage) {
		console.log(message);
	}
}
```

