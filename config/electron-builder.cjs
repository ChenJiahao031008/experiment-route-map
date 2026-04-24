module.exports = {
  appId: 'com.chenjiahao.experiment-route-map',
  productName: '实验路线演化图',
  asar: true,
  directories: {
    output: 'release',
  },
  files: [
    'dist/**/*',
    'electron/**/*',
    'package.json',
  ],
  linux: {
    target: ['deb'],
    category: 'Utility',
    executableName: 'experiment-route-map',
    maintainer: 'ChenJiahao031008',
  },
}
