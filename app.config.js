const appJson = require('./app.json');

module.exports = () => {
  const expo = appJson.expo || {};
  const isEasBuild = process.env.EAS_BUILD === 'true' || process.env.EAS_BUILD === '1';
  const baseScheme = expo.scheme || expo.slug || 'app';
  const androidGoogleServicesFile =
    process.env.GOOGLE_SERVICES_JSON || expo.android?.googleServicesFile;
  const iosGoogleServicesFile =
    process.env.GOOGLE_SERVICES_INFO_PLIST || expo.ios?.googleServicesFile;

  return {
    ...expo,
    name: expo.name,
    scheme: baseScheme,
    android: {
      ...(expo.android || {}),
      ...(androidGoogleServicesFile ? { googleServicesFile: androidGoogleServicesFile } : {}),
      runtimeVersion: "4.0.0",
    },
    ios: {
      ...(expo.ios || {}),
      ...(iosGoogleServicesFile ? { googleServicesFile: iosGoogleServicesFile } : {}),
      runtimeVersion: { policy: 'appVersion' },
    },
    updates: {
      url: "https://u.expo.dev/74e9c55f-97e5-47f7-894c-54286eef00f9",
      enabled: true,
      channel: "production",
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
    },
  };
};
