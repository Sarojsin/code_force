module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            src: './src',
          },
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        },
      ],
      [
        'babel-plugin-inline-import',
        {
          extensions: ['.sql'],
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
