'use strict';

const base = require('./base');

class tongzhi extends base {
    async addTongzhi(data) {        
        this.query('insert into tb_tongzhi set ?', data)        
    }
    async getTongzhiList() {
        return await this.select('SELECT * FROM tb_tongzhi where status = 0 ORDER BY ID limit 10');
    }
    async updateTongzhiStatus(status, id){
        await this.query('update tb_tongzhi SET status = ? where id = ?', status, id);
    }
    async getTongzhiListForPool() {
        return await this.select('SELECT * FROM tb_tongzhi where pool_check = 0 ORDER BY ID limit 10');
    }
    async updateTongzhiStatusForPool(status, id) {
        await this.query('update tb_tongzhi SET pool_check = ? where id = ?', status, id);
    }
    async updateTongzhiStatusForPoolBatch(status, ids) {
        await this.query('update tb_tongzhi SET pool_check = ? where id in(?)', status, ids);
    }
}

module.exports = tongzhi;
