import 'dotenv/config';

export default {
  expo: {
    name: 'HomeChef',
    slug: 'homechef',
    scheme: 'homechef',
    ios: { bundleIdentifier: 'com.homechef.app' },
    web: { bundler: 'metro' },
  },
};
