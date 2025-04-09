// frontend/client/craco.config.js
const WorkboxWebpackPlugin = require("workbox-webpack-plugin");
const path = require("path");

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      if (env === "production") {
        console.log(
          "CRACCO: Attempting to add InjectManifest plugin (Alt Config)."
        );

        const injectManifestPlugin = new WorkboxWebpackPlugin.InjectManifest({
          swSrc: path.resolve(__dirname, "src/service-worker.js"),
          swDest: "service-worker.js",
          // --- ADD EXCLUDE ---
          // Try excluding chunks that might interfere with manifest injection finding.
          // This is a bit of guesswork, might need adjustment.
          // We definitely don't want the SW itself included in its own manifest.
          exclude: [
            /\.map$/, // Exclude source maps
            /asset-manifest\.json$/, // Exclude the asset manifest itself
            /LICENSE\.txt/,
            /service-worker\.js$/, // Exclude the SW file itself
            // Add other patterns if specific chunks seem problematic during build errors
          ],
          // --- END EXCLUDE ---

          // Ensure maximum file size is sufficient if you have large assets
          // maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        });

        // Find existing GenerateSW or Workbox plugins to potentially remove or just add ours
        const workboxPlugins = webpackConfig.plugins.filter(
          (plugin) =>
            plugin.constructor.name === "GenerateSW" ||
            plugin.constructor.name === "InjectManifest"
        );
        if (workboxPlugins.length > 0) {
          console.log(
            `CRACCO: Found existing Workbox plugin(s): ${workboxPlugins
              .map((p) => p.constructor.name)
              .join(", ")}. Filtering them out.`
          );
          // Filter out any existing Workbox plugins to ensure ours is the only one
          webpackConfig.plugins = webpackConfig.plugins.filter(
            (plugin) => !workboxPlugins.includes(plugin)
          );
        } else {
          console.log("CRACCO: No existing Workbox plugin found.");
        }

        // Add our configured InjectManifest plugin
        webpackConfig.plugins.push(injectManifestPlugin);
        console.log(
          "CRACCO: Added InjectManifest using src/service-worker.js (Alt Config)."
        );
      } else {
        console.log(
          "CRACCO: Skipping Workbox plugin addition for non-production build."
        );
      }
      return webpackConfig;
    },
  },
};
