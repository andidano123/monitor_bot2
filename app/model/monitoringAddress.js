'use strict';

const base = require('./base');

class monitoringAddress extends base {
    async getAddressList() {
        return await this.select('SELECT * FROM tb_monitoring_address ORDER BY ID');
    }
    async getAddressArray() {
        const res = await this.select('SELECT * FROM tb_monitoring_address  ORDER BY ID');
        const array = [];
        for (let i = 0; i < res.length; i++) {
            if (array.indexOf(res[i].address) < 0)
                array.push(res[i].address);
        }
        return array;
    }
    async getAddressListPaging(page, userId, chat_id) {
        let numb = 5
        let totalNumber = ''
        let totalList = ''
        if (!userId) {
            totalNumber = await this.findOne('SELECT COUNT(*) as numb FROM tb_monitoring_address where chat_id = \'' + chat_id + '\'');
            totalList = await this.select('SELECT a.id, a.address, a.user_id, a.monitoring_money, a.monitoring_balance, a.balance, b.first_name, b.last_name FROM tb_monitoring_address a LEFT JOIN tb_user b ON a.user_id=b.id where a.chat_id = \'' + chat_id + '\' ORDER BY a.id LIMIT ?,?', numb * page, numb);
        } else {
            totalNumber = await this.findOne('SELECT COUNT(*) as numb FROM tb_monitoring_address WHERE user_id = ? and chat_id = \'' + chat_id + '\'', userId);
            totalList = await this.select('SELECT a.id, a.address, a.user_id, a.monitoring_money, a.monitoring_balance, a.balance, b.first_name, b.last_name FROM tb_monitoring_address a LEFT JOIN tb_user b ON a.user_id=b.id WHERE a.user_id = ? and a.chat_id = \'' + chat_id + '\' ORDER BY a.id LIMIT ?,?', userId, numb * page, numb);
        }
        return {
            'totalNumber': totalNumber['numb'],
            'totalList': totalList
        }
    }

    async AddAddress(data) {
        let addressExist = await this.findOne('SELECT * FROM tb_monitoring_address where address = ? and chat_id = ?', data['address'], data['chat_id']);
        if (!addressExist) {
            await this.query('INSERT INTO tb_monitoring_address SET ?', data);
        }
    }

    async updateAddressData(address, data, chat_id) {
        let addressExist = await this.findOne('SELECT * FROM tb_monitoring_address where address = ? and chat_id = ?', address, chat_id);
        if (addressExist) {
            await this.select('UPDATE tb_monitoring_address SET ? WHERE address = ? and chat_id = ?', data, address, chat_id);
            return '地址信息修改成功！'
        }
        return '地址信息不存在，请新增'
    }

    async updateChatMoney(money, chat_id) {
        await this.select('UPDATE tb_monitoring_address SET monitoring_money = ? WHERE chat_id = ?', money, chat_id);
        return '金额修改成功！'
    }

    async updateMoney(address, time, money) {
        // await this.select('UPDATE tb_monitoring_address SET balance = balance+?, update_time = ? WHERE address = ?', money, time, address);
    }

    async delAddress(address, userId = '', chat_id) {
        let addressExist = ''
        if (!userId) {
            addressExist = await this.findOne('SELECT * FROM tb_monitoring_address where address = ? and chat_id = ?', address, chat_id);
        } else {
            addressExist = await this.findOne('SELECT * FROM tb_monitoring_address where address = ? and user_id = ? and chat_id = ? ', address, userId, chat_id);
        }
        if (addressExist) {
            await this.select('DELETE FROM tb_monitoring_address WHERE address = ? and chat_id = ?', address, chat_id);
            return '地址删除成功！'
        }
        return '地址信息不存在'
    }


    async delIdAddress(userId, chat_id) {
        await this.select('DELETE FROM tb_monitoring_address WHERE user_id = ? and chat_id = ?', userId, chat_id);
        return '地址删除成功！'
    }
}

module.exports = monitoringAddress;
