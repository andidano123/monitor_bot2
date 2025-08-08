'use strict';

const base = require('./base');

class rollout extends base {
    async addTransferRecord(data) {
        let selectData = await this.findOne('SELECT * FROM tb_rollout WHERE transaction_hash=?', data['transaction_hash']);
        if (!selectData) {
            this.query('insert into tb_rollout set ?', data)
            return 1
        }
        return 0
    }
}

module.exports = rollout;
