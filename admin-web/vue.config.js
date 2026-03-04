module.exports = {
  devServer: {
    proxy: {
      "^/juhebot-api": {
        target: "https://chat-api.juhebot.com",
        changeOrigin: true,
        secure: true,
        headers: {
          // Forward a neutral referer/origin pair accepted by gateway.
          Origin: "https://chat-api.juhebot.com",
          Referer: "https://chat-api.juhebot.com/",
        },
        onProxyReq(proxyReq) {
          // Ensure forwarded request doesn't carry localhost origin.
          proxyReq.removeHeader("origin");
          proxyReq.removeHeader("referer");
          proxyReq.setHeader("Origin", "https://chat-api.juhebot.com");
          proxyReq.setHeader("Referer", "https://chat-api.juhebot.com/");
        },
        pathRewrite: {
          "^/juhebot-api": "",
        },
      },
    },
  },
};
