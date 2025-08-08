'use strict';

const base = require('./base');
const moment = require('moment');

class blockLog extends base {
    async getLastBlock(workerid, latestSlot) {
        let data = await this.findOne('SELECT * FROM tb_block_log WHERE worker='+workerid+' ORDER BY block DESC LIMIT 1');
        if (!data) {            
            let blockData = {
                'block': Math.floor(latestSlot / 10) * 10 + workerid,
                'worker': workerid,
                'create_time': moment().format('YYYY-MM-DD HH:mm:ss')
            }
            await this.query('INSERT INTO tb_block_log SET ?', blockData);
            return blockData.block;
        }
        if (data.update_time) {
            let blockData = {
                'block': data.block + 10,
                'worker': workerid,
                'create_time': moment().format('YYYY-MM-DD HH:mm:ss')
            }
            await this.query('INSERT INTO tb_block_log SET ?', blockData);
            return data.block + 10
        } else {
            return data.block
        }

    }

    async updateBlock(blockNumb) {
        await this.query('UPDATE tb_block_log SET update_time = ? WHERE block = ?;', moment().format('YYYY-MM-DD HH:mm:ss'), blockNumb);
    }
}

module.exports = blockLog;
