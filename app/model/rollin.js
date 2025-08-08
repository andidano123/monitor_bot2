'use strict';

const base = require('./base');

class rollin extends base {
    async addTransferRecord(data) {
        let selectData = await this.findOne('SELECT * FROM tb_rollin WHERE transaction_hash=?', data['transaction_hash']);
        if (!selectData) {
            this.query('insert into tb_rollin set ?', data)
            return 1
        }
        return 0
    }
}

module.exports = rollin;
