module.exports = {
  devServer: {
    proxy: {
      "^/juhebot-api": {
        target: "https://chat-api.juhebot.com",
        changeOrigin: true,
        secure: true,
        pathRewrite: {
          "^/juhebot-api": "",
        },
      },
    },
  },
};
