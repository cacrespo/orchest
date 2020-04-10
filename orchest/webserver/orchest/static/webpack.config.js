const path = require('path');

module.exports = {
    entry: './js/main.js',
    mode: 'development',
    watch: true,
    devtool: "eval",
    output: {
        path: path.resolve(__dirname, 'js/dist'),
        filename: 'main.bundle.js'
    },
    optimization: {
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
    },
    module: {
        rules: [
            {
                use: [{
                    loader: "cache-loader"
                }, {
                    loader: "babel-loader",
                    query: {
                        presets: ['@babel/preset-env'],
                    },
                }],
                include: path.resolve(__dirname, 'js'),
            }
        ]
    },
    plugins: [
        //   new webpack.ProvidePlugin({
        //   "React": "react",
        // }),
    ],
    resolve: {
        extensions: ['.js']
    }
};