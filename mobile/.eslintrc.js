module.exports = {
  root: true,
  extends: ['@react-native'],
  rules: {
    'react-native/no-inline-styles': 'error',
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.object.name='console'][callee.property.name='log']",
        message: "Don't use console.log in production code. Use the logger from src/utils/logger.ts (rule §14.4).",
      },
    ],
  },
  ignorePatterns: ['node_modules/', 'android/', 'ios/'],
};
