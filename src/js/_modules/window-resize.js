module.exports = (callback) => {
  window.addEventListener('resize', callback);
  window.addEventListener('orientationchange', callback);
};
