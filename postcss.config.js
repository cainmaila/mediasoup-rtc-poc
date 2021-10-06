module.exports = {
  plugins: {
    autoprefixer: {},
    'postcss-import': {
      path: ['./src/assets/css'],
    },
    'postcss-css-variables': {},
    'postcss-custom-media': {},
    'postcss-apply': {},
    'postcss-preset-env': {
      stage: 3,
      features: {
        'nesting-rules': true,
      },
    },
    'postcss-define-property': {},
  },
}
