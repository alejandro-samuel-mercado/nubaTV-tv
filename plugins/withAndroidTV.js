const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withAndroidTV(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const { manifest } = androidManifest;

    // 1. Declarar features de TV y deshabilitar requerimiento de pantalla táctil
    manifest["uses-feature"] = manifest["uses-feature"] || [];

    const addOrUpdateFeature = (name, required) => {
      const existing = manifest["uses-feature"].find(
        (f) => f.$ && f.$["android:name"] === name
      );
      if (existing) {
        existing.$["android:required"] = String(required);
      } else {
        manifest["uses-feature"].push({
          $: {
            "android:name": name,
            "android:required": String(required),
          },
        });
      }
    };

    // TV requiere leanback (required: false para compatibilidad con todo tipo de dispositivos TV/boxes)
    addOrUpdateFeature("android.software.leanback", false);
    // CRÍTICO: Los televisores NO tienen pantalla táctil. Si no se declara en false, Android TV rechaza abrir la app o crashea.
    addOrUpdateFeature("android.hardware.touchscreen", false);
    addOrUpdateFeature("android.hardware.faketouch", false);
    addOrUpdateFeature("android.hardware.telephony", false);
    addOrUpdateFeature("android.hardware.camera", false);
    addOrUpdateFeature("android.hardware.bluetooth", false);

    // 2. Permisos esenciales de red
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    const addPermission = (name) => {
      const exists = manifest["uses-permission"].some(
        (p) => p.$ && p.$["android:name"] === name
      );
      if (!exists) {
        manifest["uses-permission"].push({
          $: {
            "android:name": name,
          },
        });
      }
    };
    addPermission("android.permission.INTERNET");
    addPermission("android.permission.ACCESS_NETWORK_STATE");

    // 3. Modificar Application (permitir HTTP cleartext para streams IPTV) y MainActivity (LEANBACK_LAUNCHER)
    const app = manifest.application?.[0];
    if (app) {
      app.$ = app.$ || {};
      app.$["android:usesCleartextTraffic"] = "true";
    }
    if (app && app.activity) {
      const mainActivity = app.activity.find(
        (a) => a.$ && a.$["android:name"] === ".MainActivity"
      );

      if (mainActivity) {
        mainActivity["intent-filter"] = mainActivity["intent-filter"] || [];
        const mainIntent = mainActivity["intent-filter"].find((filter) => {
          return filter.action?.some(
            (act) => act.$["android:name"] === "android.intent.action.MAIN"
          );
        });

        if (mainIntent) {
          mainIntent.category = mainIntent.category || [];
          const hasLeanback = mainIntent.category.some(
            (cat) =>
              cat.$["android:name"] === "android.intent.category.LEANBACK_LAUNCHER"
          );
          if (!hasLeanback) {
            mainIntent.category.push({
              $: {
                "android:name": "android.intent.category.LEANBACK_LAUNCHER",
              },
            });
          }
        }
      }
    }

    return config;
  });
};
