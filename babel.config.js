module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
<<<<<<< HEAD
=======
    plugins: [
      ['module-resolver', {
        alias: { '@': './' },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
      }],
      // keep this so expo-router auto-registers
    ],
>>>>>>> origin/main
  };
};

