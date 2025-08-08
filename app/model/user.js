'use strict';

const base = require('./base');
const _ = require('lodash');
const promise = require('bluebird');

class user extends base {
    async getUserById(id) {
        let data = await this.findOne('SELECT * FROM tb_user WHERE id=?', id);
        if (!data) return false;


        return data;
    }

    async updateUser(data, userId) {
        return this.query('UPDATE tb_user SET ? WHERE id = ?', data, userId)
    }

    async addUser(data) {
        return this.query('insert into tb_user set ?', data)
    }


    async getMessage(cid, mid) {
        let data = await this.findOne('SELECT * FROM tb_message WHERE chat_id=? and message_id=?', cid, mid);
        if (!data) return false;


        return data;
    }

    async addMessage(data) {
        return this.query('insert into tb_message set ?', data)
    }

    async getUserAll(page,numb) {
        let totalNumber = await this.findOne('SELECT COUNT(*) as numb FROM tb_user');
        let totalList = await this.select('SELECT * FROM tb_user ORDER BY id LIMIT ?,?', numb * page, numb);
        return {
            'totalNumber': totalNumber['numb'],
            'totalList': totalList
        }
    }

    async disabledUser(id) {
        let userList = await this.findOne('SELECT * FROM tb_user WHERE id=?', id);
        if (userList) {
            await this.update("update tb_user set status=0 where id=?", id)
            return '禁用成功'
        } else {
            return 'id不存在'
        }
    }
    async getAllUsers() {
        let totalList = await this.select('SELECT * FROM tb_user ORDER BY id');
        return {
            'totalList': totalList
        }
    }


}

module.exports = user;
