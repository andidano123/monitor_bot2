'use strict';

const {Controller} = require('egg');

class HomeController extends Controller {
  async initBot() {
  }
  
  async getTongzhi() {
    const tongzhiList = await this.ctx.model.tongzhi.getTongzhiListForPool();
    this.ctx.body = { data: tongzhiList };
  }
  async updateTongZhi() {
    const { ids } = this.ctx.query;
    const ary = ids.split(",");
    // console.log("ary", ary);
    
    await this.ctx.model.tongzhi.updateTongzhiStatusForPoolBatch(1, ary);    
    this.ctx.body = { ok: true, timestamp: Date.now() };
  }
  async callbackBlock() {
    // console.log("----------------", this.ctx.request);
    this.ctx.service.bot.handleTransaction(this.ctx.request.body);
    this.ctx.body = { data: "ok" };
  }
}

module.exports = HomeController;
