const config = require("./app.json");

config.expo.android.googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json";

module.exports = config;
