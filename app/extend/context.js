'use strict';

const Trav = require('node-traverse');
const Path = require('path');

module.exports = {

  __lock: new Set(),

  get mysql() {

    const mysql = {};

    mysql.start = async () => {
      this.mysql.transactionConnection = await this.app.mysql.get('dbwrite').beginTransaction();
      return true;
    };

    mysql.commit = async () => {
      let data = false;
      if (this.mysql.transactionConnection) {
        data = await this.mysql.transactionConnection.commit();
        this.mysql.transactionConnection = undefined;
      }
      return data;
    };
    mysql.rollback = async () => {
      let data = false;
      if (this.mysql.transactionConnection) {
        data = await this.mysql.transactionConnection.rollback();
        this.mysql.transactionConnection = undefined;
      }
      return data;
    };

    Object.defineProperty(this, 'mysql', {value: mysql});
    return mysql;
  },

  get model() {
    const trav = Trav.import(Path.join(__dirname, '../model'), {
      instanceParams: [this],
      importType: Trav.IMPORT_TYPE.CLASS_INSTANCE,
      firstLetterType: Trav.FIRST_LETTER_TYPE.LOWER_CASE,
    });
    Object.defineProperty(this, 'model', {
      value: trav,
    });
    return trav;
  },
}
