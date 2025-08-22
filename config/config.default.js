/* eslint valid-jsdoc: "off" */

'use strict';

/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = appInfo => {
    /**
     * built-in config
     * @type {Egg.EggAppConfig}
     **/
    const config = {};

    // use for cookie sign key, should change to your own and keep security
    config.keys = appInfo.name + '_1637830813358_9035';

    // add your middleware config here
    config.middleware = [];

    config.security = {
        csrf: {
            enable: false,
        },
        domainWhiteList: ['*'],
    };

    config.cors = {
        origin: '*',
        allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
    };

    config.mysql = {
        clients: {
            dbread: {
                host: '107.148.41.84',
                port: '3306',
                user: 'monitoring_data',
                password: '6kL4xc8DdsFTcfak',
                database: 'monitoring_data',
                timezone: '08:00',
            },
            dbwrite: {
                host: '107.148.41.84',
                port: '3306',
                user: 'monitoring_data',
                password: '6kL4xc8DdsFTcfak',
                database: 'monitoring_data',
                timezone: '08:00',
            },
        },
        app: true,
        agent: false,
    };
    
    config.botToken = '8164334037:AAFZe8lFuWcZ0UYwOCtwoT00TdDmoOrm8WM'
    
    config.apiUrl = 'https://api.trongrid.io'
    config.apiKeyOne = '296a78a7-6cce-47e2-9dc1-ebdfd91f9cf5'
    config.apiKeyTwo = '0ba04ae5-e2eb-46bc-85ba-0638a6008390'
    config.rpc = 'https://radial-multi-shadow.solana-mainnet.quiknode.pro/c270db6af00aa1550e6819c881944e7fbb7370a1'
    config.ws = 'wss://radial-multi-shadow.solana-mainnet.quiknode.pro/c270db6af00aa1550e6819c881944e7fbb7370a1'
    //自己id
    config.chatAdminID = '7340086478'
    // config.chatAdminID = '5155582905'
    //监控自己群组id
    config.chatMy = '-4737917308'
    //监控他人群组id
    config.chatOther = '-4798725099'    
    config.sending = 1    
    // add your user config here
    const userConfig = {
        // myAppName: 'egg',
    };

    config.cluster = {
        listen: {
            port: 7002
        }
    }

    return {
        ...config,
        ...userConfig,
    };
};
