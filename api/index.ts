const { createRequestHandler } = require('expo-server/adapter/vercel');
const { join } = require('path');

module.exports = createRequestHandler({
  build: join(__dirname, '../dist/server'),
});
