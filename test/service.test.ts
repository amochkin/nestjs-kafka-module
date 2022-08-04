/**
 * Tests service to throw error if no brokers were configured using env vars:
 */
test('instance-no_config_brokers-throw', () => {
	expect(() => {
		require('../src');
	}).toThrowError('Config validation error: "KAFKA_BROKERS" is required');
});
