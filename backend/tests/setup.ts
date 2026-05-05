process.env.NODE_ENV = 'test';
process.env.HOST = 'localhost';
process.env.PORT = '3001';
process.env.IBM_CLOUD_API_KEY =
  process.env.IBM_CLOUD_API_KEY ?? 'a'.repeat(44);
process.env.IBM_CLOUD_RESOURCE_CONTROLLER_URL =
  process.env.IBM_CLOUD_RESOURCE_CONTROLLER_URL ??
  'https://resource-controller.cloud.ibm.com';
process.env.IBM_CLOUD_USAGE_REPORTS_URL =
  process.env.IBM_CLOUD_USAGE_REPORTS_URL ?? 'https://billing.cloud.ibm.com';
process.env.LOG_PRETTY = 'false';
process.env.WEBSOCKET_ENABLED = 'false';

// Made with Bob
