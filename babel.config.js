module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 ships its worklets transform in react-native-worklets.
    // This must be the LAST plugin.
    plugins: ['react-native-worklets/plugin'],
  };
};
