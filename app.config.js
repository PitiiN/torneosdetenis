const appJson = require('./app.json');

module.exports = () => {
  const expo = appJson.expo || {};
  const isEasBuild = process.env.EAS_BUILD === 'true' || process.env.EAS_BUILD === '1';

  return {
    ...expo,
    runtimeVersion: isEasBuild ? { policy: 'appVersion' } : undefined,
    updates: {
      enabled: isEasBuild,
      checkAutomatically: isEasBuild ? 'ON_ERROR_RECOVERY' : 'NEVER',
      fallbackToCacheTimeout: 0,
    },
  };
};

