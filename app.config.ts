import 'dotenv/config';

export default {
  expo: {
    name: 'HomeChef',
    slug: 'homechef',
    scheme: 'homechef',
    ios: {
      bundleIdentifier: 'com.homechef.app',
      infoPlist: {
        LSApplicationQueriesSchemes: ['comgooglemaps'],
      },
    },
    icon: './assets/AppLogoFinal2026.png',
    web: { 
      bundler: 'metro',
      favicon: './assets/YHC-New-Logo-Only.png',
      output: 'static',
    },
  },
};
