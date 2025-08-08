'use strict';

const _ = require('lodash');


class base {
  /**
   * @param {Egg.Context} ctx - egg application
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.app = ctx.app;
  }

  /** 执行sql语句
   * @param {string} sql sql语句
   * @param {...*} data 参数
   */
  async query(sql, ...data) {

    const dbread = this.app.mysql.get('dbread');
    const dbwrite = this.app.mysql.get('dbwrite');
    if (sql.search(/^select /i) === 0) {
      const startTime = Date.now();
      const data2 = await dbread.query(sql, data);
      this.ctx.logger.info('sql: ' + sql);
      this.ctx.logger.info('sql运行时间: ' + (Date.now() - startTime));
      return data2;
    }
    if (this.ctx.mysql.transactionConnection) {
      return this.ctx.mysql.transactionConnection.query(sql, data);
    }
    return dbwrite.query(sql, data);
  }

  getFirst(dataList) {
    return Promise.resolve(dataList).then(dataList => {
      if (!dataList) return false;
      if (!dataList.length) return false;
      return dataList[0];
    });
  }

  findOne(sql, ...data) {
    return this.getFirst(this.query(sql, ...data));
  }

  select(sql, ...data) {
    return this.query(sql, ...data);
  }

  async joinData(data, key = 'id', ...joinDataFns) {
    let ids = [];
    for (const fi of data) {
      ids.push(fi[key]);
    }

    if (!ids.length) return;
    ids = _.uniq(ids);

    for (const joinDataFn of joinDataFns) {

      const joinData = await joinDataFn.call(this, ids);
      data.forEach(e => {
        for (const i of joinData) {
          if (i.id === e[key]) {
            const data = {...i};
            delete data.id;
            Object.assign(e, data);
            return;
          }
        }
      });
    }
  }

  update(sql, ...data) {
    return this.query(sql, ...data).then(e => e.affectedRows);
  }
}

module.exports = base;
