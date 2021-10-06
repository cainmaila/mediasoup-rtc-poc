const fs = require('fs')
const path = require('path')
const devServer = process.env.BUILD
  ? {}
  : {
      host: 'localhost',
      port: 8090,
      https: true,
      cert: fs.readFileSync(
        path.resolve(process.env.SSL_CERT_FILE || 'localhost.pem'),
      ),
      key: fs.readFileSync(
        path.resolve(process.env.SSL_KEY_FILE || 'localhost-key.pem'),
      ),
    }

module.exports = {
  publicPath: './',
  // productionSourceMap: false /* 不需要生产环境的 source map */,
  devServer,
  configureWebpack: {
    resolve: {
      extensions: ['.js', '.vue', '.json'],
    },
    module: {
      rules: [
        {
          test: /\.mjs$/,
          include: /node_modules/,
          type: 'javascript/auto',
        },
      ],
    },
  },
  pwa: {
    workboxOptions: {
      skipWaiting: true,
      clientsClaim: true,
    },
  },
}
