'use strict';

const base = require('./base');

class swap extends base {
    async addTransferRecord(data) {
        let selectData = await this.findOne('SELECT * FROM tb_swap WHERE transaction_hash=?', data['transaction_hash']);
        if (!selectData) {
            this.query('insert into tb_swap set ?', data)
            return 1
        }
        return 0
    }
}

module.exports = swap;
