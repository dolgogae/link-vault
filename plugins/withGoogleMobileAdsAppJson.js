const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withGoogleMobileAdsAppJson(config, props) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const buildGradlePath = path.join(
        config.modRequest.platformProjectRoot,
        "build.gradle"
      );

      if (!fs.existsSync(buildGradlePath)) {
        return config;
      }

      let buildGradle = fs.readFileSync(buildGradlePath, "utf-8");

      const snippet = `
ext {
    googleMobileAdsJson = [
        getStringValue: { key, fallback -> key == "android_app_id" ? "${props.androidAppId}" : fallback },
        isFlagEnabled: { key, fallback -> fallback }
    ]
}`;

      if (!buildGradle.includes("googleMobileAdsJson")) {
        buildGradle = buildGradle.replace(
          'apply plugin: "expo-root-project"',
          `${snippet}\napply plugin: "expo-root-project"`
        );
        fs.writeFileSync(buildGradlePath, buildGradle);
      }

      return config;
    },
  ]);
}

module.exports = withGoogleMobileAdsAppJson;
