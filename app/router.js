'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const {router, controller} = app;
  router.get('/initBot', controller.home.initBot);
  router.get('/getTongzhi', controller.home.getTongzhi);
  router.get('/updateTongZhi', controller.home.updateTongZhi);
  router.post('/callbackBlock', controller.home.callbackBlock);
};
