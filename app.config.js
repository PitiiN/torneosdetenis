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
    },
    ios: {
      ...(expo.ios || {}),
      ...(iosGoogleServicesFile ? { googleServicesFile: iosGoogleServicesFile } : {}),
    },
    runtimeVersion: isEasBuild ? { policy: 'appVersion' } : undefined,
    updates: {
      enabled: isEasBuild,
      checkAutomatically: isEasBuild ? 'ON_ERROR_RECOVERY' : 'NEVER',
      fallbackToCacheTimeout: 0,
    },
  };
};
