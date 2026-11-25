import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.stitchlab.app',
  appName: 'StitchLab',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
};

export default config;
