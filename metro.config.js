const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add the .onnx extension to the list of assets
config.resolver.assetExts.push('onnx');

module.exports = config;