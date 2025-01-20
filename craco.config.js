const webpack = require('webpack');

module.exports = {
    webpack: {
        configure: {
            resolve: {
                fallback: {
                    assert: require.resolve('assert/'),
                    buffer: require.resolve('buffer/'),
                    crypto: require.resolve('crypto-browserify'),
                    http: require.resolve('stream-http'),
                    https: require.resolve('https-browserify'),
                    os: require.resolve('os-browserify/browser'),
                    stream: require.resolve('stream-browserify'),
                    url: require.resolve('url/'),
                    util: require.resolve('util/'),
                    zlib: require.resolve('browserify-zlib'),
                    path: require.resolve('path-browserify'),
                    fs: false,
                    net: false,
                    tls: false,
                    dns: false,
                    http2: false,
                    child_process: false,
                }
            },
            plugins: [
                new webpack.ProvidePlugin({
                    Buffer: ['buffer', 'Buffer'],
                    process: 'process/browser',
                }),
                new webpack.NormalModuleReplacementPlugin(/node:/, (resource) => {
                    const mod = resource.request.replace(/^node:/, '');
                    switch (mod) {
                        case 'buffer':
                            resource.request = 'buffer';
                            break;
                        case 'stream':
                            resource.request = 'readable-stream';
                            break;
                        default:
                            break;
                    }
                }),
            ],
        },
    },
};
