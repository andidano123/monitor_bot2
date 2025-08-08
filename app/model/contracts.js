'use strict';

const base = require('./base');
const moment = require('moment');

class contracts extends base {
    async getContractInfo(contract) {
        let data = await this.findOne('SELECT * FROM tb_contracts where contract = \'' + contract+'\'');
        if (data) {            
            return data
        } else {
            return null;
        }

    }
    async insertContractInfo(contractInfo){
        await this.query('INSERT INTO tb_contracts SET ?', contractInfo);
    }
    async updateContractPrice(price, contract){
        await this.query('update tb_contracts SET price = ? where contract = ?', price, contract);
    }
    async updateContractCreatorInfo(creator, create_time, contract){
        await this.query('update tb_contracts SET creator = ?, create_time = ? where contract = ?', creator, create_time, contract);
    }
}

module.exports = contracts;
