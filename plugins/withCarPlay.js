// Expo config plugin — wires the native bits CarPlay needs at build time
// (EAS / prebuild). Does nothing in Expo Go. After Apple approves your CarPlay
// entitlement, these values let the binary expose a CarPlay scene.
//
// Apple entitlements are APPROVAL-GATED: request them at
// https://developer.apple.com/contact/request/carplay-entitlement/
//   - com.apple.developer.carplay-charging  → EV charging apps (stations list)
//   - com.apple.developer.carplay-maps      → turn-by-turn navigation
// You can usually only ship the type Apple grants you; keep the one approved.
const { withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

const withCarPlay = (config) => {
  // 1) Entitlements — both requested here for the "stations + navigation" case.
  //    Remove whichever Apple does NOT approve for your account before release.
  config = withEntitlementsPlist(config, (c) => {
    c.modResults['com.apple.developer.carplay-charging'] = true;
    c.modResults['com.apple.developer.carplay-maps'] = true;
    return c;
  });

  // 2) Declare the CarPlay scene so iOS hands template scenes to the app.
  //    The delegate class is provided by react-native-carplay's iOS setup —
  //    confirm the exact name against the version you build with.
  config = withInfoPlist(config, (c) => {
    const manifest = c.modResults.UIApplicationSceneManifest || {};
    manifest.UIApplicationSupportsMultipleScenes = true;
    const cfgs = manifest.UISceneConfigurations || {};
    cfgs.CPTemplateApplicationSceneSessionRoleApplication = [
      {
        UISceneConfigurationName: 'CarPlay',
        UISceneClassName: 'CPTemplateApplicationScene',
        UISceneDelegateClassName: 'RNCarPlaySceneDelegate',
      },
    ];
    manifest.UISceneConfigurations = cfgs;
    c.modResults.UIApplicationSceneManifest = manifest;
    return c;
  });

  return config;
};

module.exports = withCarPlay;
