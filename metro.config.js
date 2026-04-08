const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add the .onnx extension to the list of assets
config.resolver.assetExts.push('onnx');

// 1. Allow .txt files (so we can load vocab.txt)
config.resolver.assetExts.push('txt');

// 2. Trick the tokenizer by pointing Node modules to our safe versions
config.resolver.extraNodeModules = {
  path: require.resolve('path-browserify'),
  fs: require.resolve('./mock-fs.js'),
};

module.exports = config;