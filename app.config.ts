import 'dotenv/config';

export default {
  expo: {
    name: 'HomeChef',
    slug: 'homechef',
    scheme: 'homechef',
    ios: { bundleIdentifier: 'com.homechef.app' },
    icon: './assets/AppLogoFinal2026.png',
    web: { 
      bundler: 'metro',
      favicon: './assets/AppLogoFinal2026.png',
      output: 'static',
    },
  },
};
