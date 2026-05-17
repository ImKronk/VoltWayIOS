module.exports = function (api) {
  api.cache(true);
  return {
    // SDK 54 ships Reanimated 4. babel-preset-expo auto-configures the
    // react-native-worklets Babel plugin — no manual plugin entry needed.
    presets: ['babel-preset-expo'],
  };
};
