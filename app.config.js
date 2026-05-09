const { execSync } = require('child_process');

const commitCount = parseInt(execSync('git rev-list --count HEAD').toString().trim());
const versionCode = commitCount + 6; // offset to ensure versionCode starts at 109

module.exports = {
  expo: {
    name: "LinkVault",
    slug: "link-vault",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/link-vault-icon.png",
    scheme: "linkvault",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/link-vault-foreground.png",
      resizeMode: "contain",
      backgroundColor: "#881AB7",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.linkvault.app",
      googleServicesFile: "./GoogleService-Info.plist",
    },
    android: {
      package: "com.dolgogae.linkvault",
      versionCode,
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/images/link-vault-foreground.png",
        monochromeImage: "./assets/images/link-vault-foreground.png",
        backgroundColor: "#881AB7",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      "@react-native-google-signin/google-signin",
      "expo-share-intent",
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: "ca-app-pub-5234234878363803~8534862763",
          iosAppId: "ca-app-pub-5234234878363803~8151719388",
        },
      ],
      [
        "./plugins/withGoogleMobileAdsAppJson",
        {
          androidAppId: "ca-app-pub-5234234878363803~8534862763",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "ed6cae4e-f8a5-47ee-9549-ab85da58381a",
      },
    },
    owner: "dolgogae",
  },
};
