'use strict';

const { Service } = require('egg');
const moment = require('moment');
const _ = require('lodash');
const axios = require('axios');
const { PublicKey } = require('@solana/web3.js');
const cluster = require('cluster');
const WebSocket = require("ws");
const sleep = (time) => {
    return new Promise(resolve => setTimeout(resolve, time))
}
class bot extends Service {
    async sendTongzhi() {
        const tongzhiList = await this.ctx.model.tongzhi.getTongzhiList();
        // console.log("tongzhiList", tongzhiList);
        for (let i = 0; i < tongzhiList.length; i++) {
            const item = tongzhiList[i];
            let status = 1;
            await this.ctx.app.bot.sendMessage(item.chat_id, item.text, {
                'parse_mode': 'Markdown',
                disable_web_page_preview: true,
                reply_markup: item.reply_markup
            }).catch(e => {
                console.log("send message error", e);
                if (e.toString().indexOf("AggregateError") >= 0)
                    status = 0;
                else status = 2;
            })
            await this.ctx.model.tongzhi.updateTongzhiStatus(status, item.id);
        }
        await sleep(1000);
        this.sendTongzhi();
    }
    async addAddressListening(addr) {
        // console.log("add listening", addr);
        // const subscribeMessage = JSON.stringify({
        //     "jsonrpc": "2.0",
        //     "id": ++this.ctx.app.ws_request_id,
        //     "method": "blockSubscribe",
        //     "params": [{
        //         "mentionsAccountOrProgram": addr
        //     },
        //     {
        //         "commitment": "confirmed",
        //         "encoding": "json",
        //         "showRewards": false,
        //         "maxSupportedTransactionVersion": 0
        //     }]
        // });
        // this.ctx.app.ws.send(subscribeMessage);
    }
    refreshAddressList() {
        setTimeout(async () => {
            this.ctx.app.addressArray = await this.ctx.model.monitoringAddress.getAddressArray();
            this.ctx.app.addressList = await this.ctx.model.monitoringAddress.getAddressList();
            // console.log("new addressList", this.ctx.app.addressList);
        }, 1000);
    }
    async addPoolWebhook() {
        // this.ctx.app.addressArray = await this.ctx.model.monitoringAddress.getAddressArray();
        // let poolAddressArray = [];
        // for (let i = 0; i < this.ctx.app.addressArray.length; i++) {
        //     let ary = this.getPoolAddress(this.ctx.app.addressArray[i]);
        //     for (let k = 0; k < ary.length; k++) {
        //         poolAddressArray.push(ary[k]);
        //     }
        // }

        const url = 'https://api.quicknode.com/webhooks/rest/v1/webhooks'

        const params = {
            limit: 20,
            offset: 0,
        }

        const headers = {
            accept: 'application/json',
            'x-api-key': 'qnsec_NGIyM2ViZTAtOGU5ZC00N2RkLTkyYjYtZTA4ZDVmZWI4Mjgw', // Replace with your actual API key
        }

        await axios
            .get(url, { headers, params })
            .then(response => {
                console.log(response.data)
            })
            .catch(error => {
                console.error('Error:', error.response?.data || error.message)
            })


    }
    async getPoolAddress(contract) {
        let pooldata = [];
        const requestOptions = {
            method: "get",
            url: "https://pro-api.solscan.io/v2.0/token/markets",
            params: {
                page: "1",
                page_size: "10",
                token: [contract]
            },
            headers: {
                token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3MzE0MDQ1OTI4ODYsImVtYWlsIjoiZ3VvZnVjaGVuZzM0NUBnbWFpbC5jb20iLCJhY3Rpb24iOiJ0b2tlbi1hcGkiLCJhcGlWZXJzaW9uIjoidjIiLCJpYXQiOjE3MzE0MDQ1OTJ9.1FZBIcarlQSnKfBmQTcLxBif3wm1n2BmDEB1oofbj3E'
            },
        }

        await axios
            .request(requestOptions)
            .then(response => {
                // pooldata = response.data.data;
                for (let i = 0; i < response.data.data.length; i++) {
                    pooldata.push(response.data.data[i].pool_id);
                }
            })
            .catch(err => console.error(err));
        if (pooldata.length == 0) {
            // 获取代币情况
            const requestOptions = {
                method: "get",
                url: "https://pro-api.solscan.io/v2.0/token/holders",
                params: {
                    address: contract,
                    page: "1",
                    page_size: "10"
                },
                headers: {
                    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3MzE0MDQ1OTI4ODYsImVtYWlsIjoiZ3VvZnVjaGVuZzM0NUBnbWFpbC5jb20iLCJhY3Rpb24iOiJ0b2tlbi1hcGkiLCJhcGlWZXJzaW9uIjoidjIiLCJpYXQiOjE3MzE0MDQ1OTJ9.1FZBIcarlQSnKfBmQTcLxBif3wm1n2BmDEB1oofbj3E'
                },
            }
            await axios
                .request(requestOptions)
                .then(response => {
                    // console.log(response.data.data.items);
                    if (response.data.data.items.length > 0) {
                        pooldata.push(
                            response.data.data.items[0].owner,
                        )
                    }

                })
                .catch(err => console.error(err));
        }
        return pooldata;
    }

    async removeListening(addr) {
        this.refreshAddressList();
        if (this.ctx.app.addressArray.indexOf(addr) < 0) {
            console.log("need unsubscribe");
            // const subscribeMessage = JSON.stringify({
            //     "jsonrpc": "2.0",
            //     "id": ++this.ctx.app.ws_request_id,
            //     "method": "blockUnsubscribe",
            //     "params": [0]
            // });
            // this.ctx.app.ws.send(subscribeMessage);
        }
    }
    async handleTransaction(txData) {
        // console.log("current address list", this.ctx.app.addressList);
        this.ctx.app.addressArray = await this.ctx.model.monitoringAddress.getAddressArray();
        this.ctx.app.addressList = await this.ctx.model.monitoringAddress.getAddressList();
        const addressArray = this.ctx.app.addressArray;
        const addressList = this.ctx.app.addressList;
        try {

            const res = txData[0];
            console.log("['transactions']", res['transactions']);
            for (let k = 0; k < res['transactions'].length; k++) {
                const res2 = res['transactions'][k]['raw'];
                if (res2.meta.err != null) continue;    // 失败的交易不用看了
                let flagSwap = false, flagAdd = false;
                for (let j = 0; j < res2.meta.logMessages.length; j++) {
                    if (
                        res2.meta.logMessages[j].indexOf("AddLiquidity") >= 0 ||
                        res2.meta.logMessages[j].indexOf("OpenPosition") >= 0 ||
                        res2.meta.logMessages[j].indexOf("IncreaseLiquidity") >= 0

                    ) {
                        flagAdd = true;
                        break;
                    }
                    if (
                        res2.meta.logMessages[j].indexOf("Swap") >= 0) {
                        flagSwap = true;
                        break;
                    }
                }

                if (flagSwap || flagAdd) {
                    let isMonitoringMoneyText = ''
                    let money = 0;
                    let owner = '';
                    try {
                        if (res2.transaction.message.staticAccountKeys)
                            owner = res2.transaction.message.staticAccountKeys[0];
                        else owner = res2.transaction.message.accountKeys[0];
                        owner = owner.pubkey;
                    } catch (e) {
                        console.log("e", e);
                        console.log("special", res2);
                    }
                    if (owner == '') continue;
                    console.log("res2", JSON.stringify(res2));
                    let fromMint = '';
                    for (let i = 0; i < res2.meta.postTokenBalances.length; i++) {
                        const item = res2.meta.postTokenBalances[i];
                        const pos = addressArray.indexOf(item.mint);
                        console.log("swap ", res2.meta.postTokenBalances[i].owner, item.mint);
                        if (pos >= 0 && owner == res2.meta.postTokenBalances[i].owner) {
                            // owner = res2.meta.postTokenBalances[i].owner;                            
                            money = Number(item.uiTokenAmount.uiAmountString) - this.getPostTokenBalance(res2.meta.preTokenBalances, item.mint, owner);
                            console.log("xxxx", item.uiTokenAmount.uiAmountString, this.getPostTokenBalance(res2.meta.preTokenBalances, item.mint, owner));
                            if (money == 0 && !flagAdd) continue;
                            fromMint = item.mint;
                            break;
                        }
                    }
                    console.log("money", money);
                    if (flagAdd) {
                        if (fromMint == '') continue;
                    } else {
                        if (money == 0) continue;
                    }

                    const operation_model = 2
                    let sqlData = {
                        'model': operation_model,
                        'transaction_hash': res2.transaction.signatures[0],
                        'money1': money,
                        'contract1': fromMint,
                        'money2': 0,
                        'contract2': '',
                        'owner': owner,
                        'create_time': moment().format('YYYY-MM-DD HH:mm:ss'),
                    }
                    let money2 = 0;
                    for (let i = 0; i < res2.meta.postTokenBalances.length; i++) {
                        const item = res2.meta.postTokenBalances[i];
                        if (item.owner == owner) {
                            if (fromMint != item.mint) {
                                money2 = Number(item.uiTokenAmount.uiAmountString) - this.getPostTokenBalance(res2.meta.preTokenBalances, item.mint, owner);
                                sqlData.contract2 = item.mint;
                                sqlData.money2 = money2;
                            }
                        }
                    }
                    // 这意思是 花的是SOL
                    if (money2 == 0) {
                        money2 = (Number(res2.meta.postBalances[0]) - Number(res2.meta.preBalances[0])) / (10 ** 9);
                        sqlData.contract2 = "So11111111111111111111111111111111111111112";
                        sqlData.money2 = money2;
                    }

                    let existTransaction = await this.ctx.model.swap.addTransferRecord(sqlData);
                    if (existTransaction == 0) continue;

                    // 监听同样的群， 都要通知
                    for (let i = 0; i < addressList.length; i++) {
                        let addressData = addressList[i];
                        if (addressData.address != fromMint) continue;

                        const contractInfo1 = await this.getContractInfo(sqlData.contract1);
                        const contractInfo2 = await this.getContractInfo(sqlData.contract2);
                        const mainContractInfo = (sqlData.contract1 == addressData.address) ? contractInfo1 : contractInfo2;
                        let checkval = (Math.abs(money) * contractInfo1.price);
                        if (checkval <= 0) checkval = (Math.abs(money2) * contractInfo2.price);
                        if (checkval >= Number(addressData.monitoring_money)) {
                            isMonitoringMoneyText = '⚠️本次【兑换】交易额度到达预警\n'
                            let text = "";
                            if (flagAdd) {
                                text = '【添加】**[' + mainContractInfo.symbol + '](https://solscan.io/token/' + mainContractInfo.contract + ')**' + ' ' + checkval.toFixed(2) + '\n' +
                                    '*监控地址：*\n`' + addressData.address + '`\n' +
                                    (money < 0 ? (
                                        '订单详情：**[' + contractInfo1.symbol + '](https://solscan.io/token/' + contractInfo1.contract + ')**' + Math.abs(money).toFixed(4) + '($' + (Math.abs(money) * contractInfo1.price).toFixed(2) + ') 兑换' +
                                        ' **[' + contractInfo2.symbol + '](https://solscan.io/token/' + contractInfo2.contract + ')**' + Math.abs(money2).toFixed(4) + '($' + (Math.abs(money2) * contractInfo2.price).toFixed(2) + ')\n'
                                    ) : (
                                        '订单金额：**[' + contractInfo2.symbol + '](https://solscan.io/token/' + contractInfo2.contract + ')**' + Math.abs(money2).toFixed(4) + '($' + (Math.abs(money2) * contractInfo2.price).toFixed(2) + ') 兑换' +
                                        ' **[' + contractInfo1.symbol + '](https://solscan.io/token/' + contractInfo1.contract + ')**' + Math.abs(money).toFixed(4) + '($' + (Math.abs(money) * contractInfo1.price).toFixed(2) + ')\n'
                                    )
                                    ) + '监控金额：' + (addressData.monitoring_money).toFixed(4) + '\n'
                                    + '发币地址：' + mainContractInfo.creator + '\n'
                                    + '创建时间：' + this.formatDate(new Date(mainContractInfo.create_time * 1000)) + '\n' + isMonitoringMoneyText;
                            } else {
                                text = (money > 0 ? ('【购买】**[' + contractInfo2.symbol + '](https://solscan.io/token/' + contractInfo2.contract + ')**' + ' ' + checkval.toFixed(2))
                                    : ('【出售】**[' + contractInfo1.symbol + '](https://solscan.io/token/' + contractInfo1.contract + ')**' + ' ' + checkval.toFixed(2))) + '\n' +
                                    '*监控地址：*\n`' + addressData.address + '`\n' +
                                    (money < 0 ? (
                                        '订单详情：**[' + contractInfo1.symbol + '](https://solscan.io/token/' + contractInfo1.contract + ')**' + Math.abs(money).toFixed(4) + '($' + (Math.abs(money) * contractInfo1.price).toFixed(2) + ') 兑换' +
                                        ' **[' + contractInfo2.symbol + '](https://solscan.io/token/' + contractInfo2.contract + ')**' + Math.abs(money2).toFixed(4) + '($' + (Math.abs(money2) * contractInfo2.price).toFixed(2) + ')\n'
                                    ) : (
                                        '订单金额：**[' + contractInfo2.symbol + '](https://solscan.io/token/' + contractInfo2.contract + ')**' + Math.abs(money2).toFixed(4) + '($' + (Math.abs(money2) * contractInfo2.price).toFixed(2) + ') 兑换' +
                                        ' **[' + contractInfo1.symbol + '](https://solscan.io/token/' + contractInfo1.contract + ')**' + Math.abs(money).toFixed(4) + '($' + (Math.abs(money) * contractInfo1.price).toFixed(2) + ')\n'
                                    )
                                    ) + '监控金额：' + (addressData.monitoring_money).toFixed(4) + '\n'
                                    + '发币地址：' + mainContractInfo.creator + '\n'
                                    + '创建时间：' + this.formatDate(new Date(mainContractInfo.create_time * 1000)) + '\n' + isMonitoringMoneyText;
                            }

                            let reply_markup = JSON.stringify({
                                inline_keyboard: [
                                    [{
                                        text: '查看交易',
                                        url: 'https://solscan.io/tx/' + res2.transaction.signatures[0]
                                    }, {
                                        text: '查看钱包',
                                        url: 'https://solscan.io/account/' + addressData.address
                                    }]
                                ]
                            })
                            console.log("text", text);
                            await this.ctx.model.tongzhi.addTongzhi({
                                chat_id: addressData.chat_id,
                                text,
                                reply_markup,
                                status: 0,
                                add_time: (new Date()).getTime() / 1000,
                                send_time: 0
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error("解析交易失败:", error);
        }
    }
    //获取列表
    // async getBlock() { }
    getPostTokenBalance(tokenBalances, mint, owner) {
        for (let i = 0; i < tokenBalances.length; i++) {
            if (tokenBalances[i].mint == mint && tokenBalances[i].owner == owner)
                return Number(tokenBalances[i].uiTokenAmount.uiAmountString);
        }
        return 0;
    }
    async getBlock() {
        console.log("getting block", cluster.worker.id - 1);

        let addressList = await this.ctx.model.monitoringAddress.getAddressList();
        let addressArray = await this.ctx.model.monitoringAddress.getAddressArray();
        console.log("getAddressArray", addressArray);
        const latestSlot = await this.ctx.app.connection.getSlot();
        console.log("最新区块高度 (Slot):", latestSlot);
        let blockNumb = await this.ctx.model.blockLog.getLastBlock(cluster.worker.id - 1, latestSlot);
        // if (blockNumb > latestSlot) return;
        blockNumb = 351662039;
        console.log("blockNumb", blockNumb);
        try {
            const res = await this.ctx.app.connection.getBlock(blockNumb, {
                "encoding": "json",
                "maxSupportedTransactionVersion": 0,
                "transactionDetails": "full",
                "rewards": false
            });
            if (res) {
                if (res.hasOwnProperty('transactions')) {
                    console.log("最新区块数量:", res['transactions'].length);
                    for (let k = 0; k < res['transactions'].length; k++) {
                        const res2 = res['transactions'][k];
                        if (res2.transaction.signatures[0] == "5u1FptQ22bE8mrLiBkXM5Cb2yBnmL3WYPZYAE8oAk9yN75NfLgZu7SCVyd3F6AVWw8jp1GR6LpsVorgoqzAmbGuy") {
                            try {
                                console.log("sinboss", JSON.stringify(res2));
                                let flagSwap = false, flagAdd = false;
                                let hasToken = false;
                                let flagDCA = false;
                                for (let j = 0; j < res2.meta.logMessages.length; j++) {

                                    if (
                                        res2.meta.logMessages[j].indexOf("AddLiquidity") >= 0 ||
                                        res2.meta.logMessages[j].indexOf("OpenPosition") >= 0 ||
                                        res2.meta.logMessages[j].indexOf("IncreaseLiquidity") >= 0
                                    ) {
                                        flagAdd = true;
                                        break;
                                    }
                                    if (
                                        res2.meta.logMessages[j].indexOf("Swap") >= 0) {
                                        flagSwap = true;
                                        break;
                                    }
                                    if (res2.meta.logMessages[j].indexOf("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4") >= 0) {
                                        flagDCA = true;
                                    }
                                }
                                if ((flagSwap || flagAdd) && !flagDCA) {
                                    console.log("swap--------------------");
                                    let isMonitoringMoneyText = ''
                                    let money = 0;
                                    let owner = '';
                                    try {
                                        if (res2.transaction.message.staticAccountKeys)
                                            owner = res2.transaction.message.staticAccountKeys[0];
                                        else owner = res2.transaction.message.accountKeys[0];
                                        // owner = owner.toBase58();
                                    } catch (e) {
                                        console.log("e", e);
                                        console.log("special", res2);
                                    }
                                    let addressData = null;
                                    let fromMint = '';
                                    for (let i = 0; i < res2.meta.postTokenBalances.length; i++) {
                                        const item = res2.meta.postTokenBalances[i];
                                        const pos = addressArray.indexOf(item.mint);
                                        console.log("woner", pos, owner, res2.meta.postTokenBalances[i].owner, item.mint);
                                        if (pos >= 0 && owner == res2.meta.postTokenBalances[i].owner) {
                                            console.log("hi");
                                            hasToken = true;
                                            addressData = addressList[pos];
                                            // owner = res2.meta.postTokenBalances[i].owner;
                                            money = Number(item.uiTokenAmount.uiAmountString) - this.getPostTokenBalance(res2.meta.preTokenBalances, item.mint, owner)
                                            if (money == 0) continue;
                                            fromMint = item.mint;
                                            break;
                                        }
                                    }
                                    console.log("flagAdd", flagAdd, hasToken, money);

                                    if (flagAdd) {
                                        if (!hasToken) continue;
                                        fromMint = addressData.address;
                                    } else {
                                        if (money == 0) continue;
                                    }
                                    console.log("abc");
                                    const operation_model = 2
                                    let sqlData = {
                                        'model': operation_model,
                                        'transaction_hash': res2.transaction.signatures[0],
                                        'money1': money,
                                        'contract1': fromMint,
                                        'money2': 0,
                                        'contract2': '',
                                        'owner': owner,
                                        'create_time': moment().format('YYYY-MM-DD HH:mm:ss'),
                                    }
                                    let money2 = 0;
                                    for (let i = 0; i < res2.meta.postTokenBalances.length; i++) {
                                        const item = res2.meta.postTokenBalances[i];
                                        if (item.owner == owner) {
                                            if (fromMint != item.mint) {
                                                money2 = Number(item.uiTokenAmount.uiAmountString) - this.getPostTokenBalance(res2.meta.preTokenBalances, item.mint, owner)
                                                sqlData.contract2 = item.mint;
                                                sqlData.money2 = money2;
                                            }
                                        }
                                    }
                                    // 这意思是 花的是SOL
                                    if (money2 == 0) {
                                        money2 = (Number(res2.meta.postBalances[0]) - Number(res2.meta.preBalances[0])) / (10 ** 9);
                                        sqlData.contract2 = "So11111111111111111111111111111111111111112";
                                        sqlData.money2 = money2;
                                    }
                                    console.log("sqlData", sqlData);
                                    let existTransaction = await this.ctx.model.swap.addTransferRecord(sqlData);
                                    if (flagAdd) {
                                        isMonitoringMoneyText = '⚠️本次【添加】交易额度到达预警\n'
                                    }
                                    else {
                                        if (existTransaction > 0) {
                                            if (Math.abs(money) >= addressData.monitoring_money && operation_model === 2) {
                                                isMonitoringMoneyText = '⚠️本次【兑换】交易额度到达预警\n'
                                            }
                                        }
                                    }
                                    if (isMonitoringMoneyText) {
                                        const contractInfo1 = await this.getContractInfo(sqlData.contract1);
                                        const contractInfo2 = await this.getContractInfo(sqlData.contract2);
                                        let text =
                                            // '*交易哈希：' + '*[' + res2.transaction.signatures[0] + '](https://solscan.io/tx/' + res2.transaction.signatures[0] + ')**' + '\n' +
                                            (money > 0 ? '🟢' : '🔴') + '*监控地址：*\n`' + addressData.address + '`\n' +
                                            (money > 0 ? (
                                                '订单金额：**[' + contractInfo1.symbol + '](https://solscan.io/token/' + contractInfo1.contract + ')**' + Math.abs(money).toFixed(4) + '($' + (Math.abs(money) * contractInfo1.price).toFixed(2) + ') 兑换' +
                                                ' **[' + contractInfo2.symbol + '](https://solscan.io/token/' + contractInfo2.contract + ')**' + Math.abs(money2).toFixed(4) + '($' + (Math.abs(money2) * contractInfo2.price).toFixed(2) + ')\n'
                                            ) : (
                                                '订单金额：**[' + contractInfo2.symbol + '](https://solscan.io/token/' + contractInfo2.contract + ')**' + Math.abs(money2).toFixed(4) + '($' + (Math.abs(money2) * contractInfo2.price).toFixed(2) + ') 兑换' +
                                                ' **[' + contractInfo1.symbol + '](https://solscan.io/token/' + contractInfo1.contract + ')**' + Math.abs(money).toFixed(4) + '($' + (Math.abs(money) * contractInfo1.price).toFixed(2) + ')\n'
                                            )
                                            ) +
                                            '监控金额：' + (addressData.monitoring_money).toFixed(4) + '\n' +
                                            isMonitoringMoneyText;
                                        let reply_markup = JSON.stringify({
                                            inline_keyboard: [
                                                [{
                                                    text: '🏦查看交易',
                                                    url: 'https://solscan.io/tx/' + res2.transaction.signatures[0]
                                                }, {
                                                    text: '🧰查看钱包',
                                                    url: 'https://solscan.io/account/' + addressData.address
                                                }]
                                            ]
                                        })
                                        console.log("text", text);
                                        if (this.ctx.app.config.chatAdminID !== addressData.user_id) {
                                            this.ctx.app.bot.sendMessage(addressData.user_id, text, {
                                                'parse_mode': 'Markdown',
                                                disable_web_page_preview: true,
                                                reply_markup
                                            }).catch(e => {
                                                this.ctx.logger.error(e);
                                            })
                                            this.ctx.app.bot.sendMessage(this.ctx.app.config.chatOther, text, {
                                                'parse_mode': 'Markdown',
                                                disable_web_page_preview: true,
                                                reply_markup
                                            }).catch(e => {
                                                this.ctx.logger.error(e);
                                            })
                                        } else {
                                            this.ctx.app.bot.sendMessage(this.ctx.app.config.chatMy, text, {
                                                'parse_mode': 'Markdown',
                                                disable_web_page_preview: true,
                                                reply_markup
                                            }).catch(e => {
                                                this.ctx.logger.error(e);
                                            })
                                        }
                                    }
                                } else if (flagDCA) {
                                    // DCA
                                    let fromMint = '';
                                    let money = 0;
                                    let addressData = null;
                                    for (let i = 0; i < res2.meta.postTokenBalances.length; i++) {
                                        const item = res2.meta.postTokenBalances[i];
                                        const pos = addressArray.indexOf(item.mint);
                                        if (pos >= 0) {
                                            let temp = Math.abs(Number(item.uiTokenAmount.uiAmountString) - this.getPostTokenBalance(res2.meta.preTokenBalances, item.mint, item.owner));
                                            if (temp > money) money = temp;
                                            fromMint = item.mint;
                                            addressData = addressList[pos];
                                        }
                                    }

                                    console.log("abc");
                                    const operation_model = 2
                                    let sqlData = {
                                        'model': operation_model,
                                        'transaction_hash': res2.transaction.signatures[0],
                                        'money1': money,
                                        'contract1': fromMint,
                                        'money2': 0,
                                        'contract2': '',
                                        'owner': '',
                                        'create_time': moment().format('YYYY-MM-DD HH:mm:ss'),
                                    }
                                    let money2 = 0;
                                    for (let i = 0; i < res2.meta.postTokenBalances.length; i++) {
                                        const item = res2.meta.postTokenBalances[i];
                                        if (fromMint != item.mint) {
                                            let temp = Math.abs(Number(item.uiTokenAmount.uiAmountString) - this.getPostTokenBalance(res2.meta.preTokenBalances, item.mint, item.owner));
                                            if (temp > money2) money2 = temp;
                                            sqlData.contract2 = item.mint;
                                            sqlData.money2 = money2;
                                        }
                                    }
                                    // 这意思是 花的是SOL
                                    if (money2 == 0) {
                                        money2 = (Number(res2.meta.postBalances[0]) - Number(res2.meta.preBalances[0])) / (10 ** 9);
                                        sqlData.contract2 = "So11111111111111111111111111111111111111112";
                                        sqlData.money2 = money2;
                                    }
                                    console.log("sqlData", sqlData);
                                    let existTransaction = await this.ctx.model.swap.addTransferRecord(sqlData);
                                    let isMonitoringMoneyText = '';
                                    // if (existTransaction > 0) 
                                    {
                                        if (operation_model === 2) {
                                            isMonitoringMoneyText = '⚠️本次【DCA兑换】交易额度到达预警\n'
                                        }
                                    }
                                    if (isMonitoringMoneyText) {
                                        const contractInfo1 = await this.getContractInfo(sqlData.contract1);
                                        const contractInfo2 = await this.getContractInfo(sqlData.contract2);
                                        let text =
                                            // '*交易哈希：' + '*[' + res2.transaction.signatures[0] + '](https://solscan.io/tx/' + res2.transaction.signatures[0] + ')**' + '\n' +
                                            (money > 0 ? '🟢' : '🔴') + '*监控地址：*\n`' + addressData.address + '`\n' +
                                            (money > 0 ? (
                                                '订单金额：**[' + contractInfo1.symbol + '](https://solscan.io/token/' + contractInfo1.contract + ')**' + Math.abs(money).toFixed(4) + '($' + (Math.abs(money) * contractInfo1.price).toFixed(2) + ') 兑换' +
                                                ' **[' + contractInfo2.symbol + '](https://solscan.io/token/' + contractInfo2.contract + ')**' + Math.abs(money2).toFixed(4) + '($' + (Math.abs(money2) * contractInfo2.price).toFixed(2) + ')\n'
                                            ) : (
                                                '订单金额：**[' + contractInfo2.symbol + '](https://solscan.io/token/' + contractInfo2.contract + ')**' + Math.abs(money2).toFixed(4) + '($' + (Math.abs(money2) * contractInfo2.price).toFixed(2) + ') 兑换' +
                                                ' **[' + contractInfo1.symbol + '](https://solscan.io/token/' + contractInfo1.contract + ')**' + Math.abs(money).toFixed(4) + '($' + (Math.abs(money) * contractInfo1.price).toFixed(2) + ')\n'
                                            )
                                            ) +
                                            '监控金额：' + (addressData.monitoring_money).toFixed(4) + '\n' +
                                            isMonitoringMoneyText;
                                        let reply_markup = JSON.stringify({
                                            inline_keyboard: [
                                                [{
                                                    text: '🏦查看交易',
                                                    url: 'https://solscan.io/tx/' + res2.transaction.signatures[0]
                                                }, {
                                                    text: '🧰查看钱包',
                                                    url: 'https://solscan.io/account/' + addressData.address
                                                }]
                                            ]
                                        })
                                        console.log("text", text);
                                        if (this.ctx.app.config.chatAdminID !== addressData.user_id) {
                                            this.ctx.app.bot.sendMessage(addressData.user_id, text, {
                                                'parse_mode': 'Markdown',
                                                disable_web_page_preview: true,
                                                reply_markup
                                            }).catch(e => {
                                                this.ctx.logger.error(e);
                                            })
                                            this.ctx.app.bot.sendMessage(this.ctx.app.config.chatOther, text, {
                                                'parse_mode': 'Markdown',
                                                disable_web_page_preview: true,
                                                reply_markup
                                            }).catch(e => {
                                                this.ctx.logger.error(e);
                                            })
                                        } else {
                                            this.ctx.app.bot.sendMessage(this.ctx.app.config.chatMy, text, {
                                                'parse_mode': 'Markdown',
                                                disable_web_page_preview: true,
                                                reply_markup
                                            }).catch(e => {
                                                this.ctx.logger.error(e);
                                            })
                                        }
                                    }
                                }
                            } catch (e) {
                                console.log("sinboss", e);
                            }
                        }
                    }
                }
            } else {
                console.log("最新区块未生成或不可用");
            }

            this.ctx.model.blockLog.updateBlock(blockNumb);
        } catch (e) {
            console.log(e);
            if (e.toString().indexOf("skip") >= 0) this.ctx.model.blockLog.updateBlock(blockNumb);
        }

    }
    async getContractInfo(contract, notfetch) {
        let res = await this.ctx.model.contracts.getContractInfo(contract);
        if (res == null) {
            let contractInfo = null;
            // console.log("contract info", contract)
            try {
                // 获取mint信息
                const requestOptions = {
                    method: "get",
                    url: "https://pro-api.solscan.io/v2.0/token/meta",
                    params: {
                        address: contract,
                    },
                    headers: {
                        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3MzE0MDQ1OTI4ODYsImVtYWlsIjoiZ3VvZnVjaGVuZzM0NUBnbWFpbC5jb20iLCJhY3Rpb24iOiJ0b2tlbi1hcGkiLCJhcGlWZXJzaW9uIjoidjIiLCJpYXQiOjE3MzE0MDQ1OTJ9.1FZBIcarlQSnKfBmQTcLxBif3wm1n2BmDEB1oofbj3E"
                    },
                }
                await axios
                    .request(requestOptions)
                    .then(response => {

                        contractInfo = {
                            contract: contract,
                            symbol: response.data.data.symbol,
                            price: response.data.data.price || 0,
                            creator: response.data.data.creator,
                            create_time: response.data.data.created_time || 0,
                        }
                    })
                    .catch(err => console.error(err));
                console.log("contractInfo", contractInfo, notfetch);
                if (contractInfo.price == 0 && notfetch != 1) {
                    try {
                        await axios.get('https://api.jup.ag/price/v2?ids=' + contract, {}).then((response) => {
                            contractInfo.price = response.data.data[contract]?.price;
                        })
                    }
                    catch (e) {
                        console.log("获取 价格 error", e);
                    }
                }
            } catch (e) {
                console.log("error", e);
            }

            if (contractInfo != null) {
                this.ctx.model.contracts.insertContractInfo(contractInfo);
                return contractInfo;
            }
            else
                return {
                    symbol: '未知',
                    price: 0,
                    creator: '',
                    create_time: 0
                }
        } else {
            if (res.price == 0 && notfetch != 1) {
                try {
                    await axios.get('https://api.jup.ag/price/v2?ids=' + contract, {}).then((response) => {
                        res.price = response.data.data[contract]?.price;
                        this.ctx.model.contracts.updateContractPrice(res.price, contract);
                    })
                }
                catch (e) {
                    console.log("获取 价格 error", e);
                }
            }
            console.log("contract info", res);
            if (res.creator == '' && res.create_time == 0 || (res.creator == undefined)) {
                const requestOptions = {
                    method: "get",
                    url: "https://pro-api.solscan.io/v2.0/token/meta",
                    params: {
                        address: contract,
                    },
                    headers: {
                        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3MzE0MDQ1OTI4ODYsImVtYWlsIjoiZ3VvZnVjaGVuZzM0NUBnbWFpbC5jb20iLCJhY3Rpb24iOiJ0b2tlbi1hcGkiLCJhcGlWZXJzaW9uIjoidjIiLCJpYXQiOjE3MzE0MDQ1OTJ9.1FZBIcarlQSnKfBmQTcLxBif3wm1n2BmDEB1oofbj3E"
                    },
                }
                await axios
                    .request(requestOptions)
                    .then(response => {
                        console.log("sinboss", response.data);
                        res.creator = response.data.data.creator || "未知";
                        res.create_time = response.data.data.created_time;
                        this.ctx.model.contracts.updateContractCreatorInfo(res.creator, res.create_time, contract);
                    })
                    .catch(err => console.error(err));
            }
            console.log("res", res);
            return res;
        }
    }
    formatDate(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 注意月份从 0 开始
        const day = date.getDate();
        return `${year}年${month}月${day}日`;
    }
    async addAddressList(addressList) {
        for (let i = 0; i < addressList.length; i++) {
            let addressData = addressList[i];
            // const balance = await contract.methods.balanceOf(addressData['address']).call();
            // const tokenAccounts = await this.ctx.app.connection.getParsedTokenAccountsByOwner(new PublicKey(addressData['address']), {
            //     mint: new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"), // 筛选出特定 Mint 的账户 usdt
            // });
            // if (tokenAccounts.value.length === 0)
            //     addressData['balance'] = 0;
            // else addressData['balance'] = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
            addressData['balance'] = 0;
            addressData['create_time'] = moment().format('YYYY-MM-DD HH:mm:ss')
            const contractInfo = await this.getContractInfo(addressData['address']);
            console.log("contract", contractInfo);
            await this.ctx.model.monitoringAddress.AddAddress(addressData);
            if (this.ctx.app.addressArray.indexOf(addressData['address']) < 0)
                this.addAddressListening(addressData['address']);
        }
        // 添加地址之后更新地址信息
        this.refreshAddressList();
        return 1
    }

    async getUserList(bot, ctx, msg, chat_id, page = 0) {
        let selectData = await ctx.model.user.getUserAll(page, 15);
        let allListText = ''
        if (selectData.totalList.length > 0) {
            selectData.totalList.forEach(res => {
                allListText += (
                    '\n【' + res['id'] + '】 ' +
                    (res['first_name'] ? res['first_name'] : '') +
                    (res['last_name'] ? ' ' + res['last_name'] : '') +
                    (res['username'] ? ' @' + res['username'] : '') +
                    (res['status'] > 0 ? ' 正常' : ' 禁用')
                )
            })
            //总页数
            let totalPage = Math.ceil(selectData.totalNumber / 15)
            console.log('totalPage', totalPage)
            allListText += ('\n\n共' + totalPage + '页，当前第' + (page + 1) + '页，共' + selectData.totalNumber + '个用户')
            //仅一页
            let reply_markup = ''
            //第一页
            if (page === 0 && totalPage > 1) {
                reply_markup = JSON.stringify({
                    inline_keyboard: [
                        [{
                            text: '下一页➡️',
                            callback_data: 'userList_' + (page + 1)
                        },
                        {
                            text: '尾页↪️',
                            callback_data: 'userList_' + (totalPage - 1)
                        }]
                    ]
                })
                //最后一页
            } else if (page + 1 === totalPage && totalPage > 1) {
                reply_markup = JSON.stringify({
                    inline_keyboard: [
                        [{ text: '🏠首页', callback_data: 'userList_0' },
                        {
                            text: '◀️上一页',
                            callback_data: 'userList_' + (page - 1)
                        }]
                    ]
                })
            } else if (page > 0 && totalPage > 2) {
                reply_markup = JSON.stringify({
                    inline_keyboard: [
                        [{ text: '🏠首页', callback_data: 'userList_0' },
                        {
                            text: '◀️上一页',
                            callback_data: 'userList_' + (page - 1)
                        },
                        {
                            text: '下一页➡️',
                            callback_data: 'userList_' + (page + 1)
                        },
                        {
                            text: '尾页↪️',
                            callback_data: 'userList_' + (totalPage - 1)
                        }]
                    ]
                })
            }
            if (chat_id) {
                await bot.editMessageText(allListText, {
                    chat_id,
                    message_id: msg.message.message_id,
                    reply_markup
                });
            } else {
                await bot.sendMessage(msg.chat.id, allListText, {
                    'reply_to_message_id': msg.message_id,
                    reply_markup
                });
            }

        } else {
            await bot.sendMessage(msg.chat.id, '没有用户', {
                'reply_to_message_id': msg.message_id
            });
        }

    }

    async getUserListKeypad(bot, ctx, msg, page = 0) {
        let selectData = await ctx.model.user.getUserAll(page, 6);
        if (selectData.totalList.length > 0) {
            let countNum = 0
            let totalKeypadList = []
            let keypadList = []
            selectData.totalList.forEach(res => {
                countNum += 1
                keypadList.push({
                    text: '👤' + (res['first_name'] ? res['first_name'] : '') + (res['last_name'] ? ' ' + res['last_name'] : ''),
                    callback_data: res['id']
                })
                if (countNum % 2 === 0) {
                    totalKeypadList.push(keypadList)
                    keypadList = []
                }
            })
            //总页数
            let totalPage = Math.ceil(selectData.totalNumber / 6)
            //仅一页
            let reply_markup = ''
            //第一页
            if (page === 0 && totalPage > 1) {
                totalKeypadList.push([{
                    text: '下一页➡️',
                    callback_data: 'userKeypad_' + (page + 1)
                },
                {
                    text: '尾页↪️',
                    callback_data: 'userKeypad_' + (totalPage - 1)
                }])
                //最后一页
            } else if (page + 1 === totalPage && totalPage > 1) {
                totalKeypadList.push([{ text: '🏠首页', callback_data: 'userKeypad_0' },
                {
                    text: '◀️上一页',
                    callback_data: 'userKeypad_' + (page - 1)
                }])
            } else if (page > 0 && totalPage > 2) {
                totalKeypadList.push(
                    [{ text: '🏠首页', callback_data: 'userKeypad_0' },
                    {
                        text: '◀️上一页',
                        callback_data: 'userKeypad_' + (page - 1)
                    },
                    {
                        text: '下一页➡️',
                        callback_data: 'userKeypad_' + (page + 1)
                    },
                    {
                        text: '尾页↪️',
                        callback_data: 'userKeypad_' + (totalPage - 1)
                    }]
                )
            }
            reply_markup = JSON.stringify({
                inline_keyboard: totalKeypadList
            })
            await bot.editMessageText('请选则用户', {
                chat_id: msg.message.chat.id,
                message_id: msg.message.message_id,
                'reply_to_message_id': msg.message_id,
                reply_markup
            });
        } else {
            await bot.editMessageText('没有用户', {
                chat_id: msg.message.chat.id,
                message_id: msg.message.message_id,
                'reply_to_message_id': msg.message_id
            });
        }
    }

    async getAllAddress(bot, ctx, msg, chat_id, page = 0, userId = '') {

        let selectData = null;
        if (chat_id) selectData = await this.ctx.model.monitoringAddress.getAddressListPaging(page, userId, chat_id);
        else selectData = await this.ctx.model.monitoringAddress.getAddressListPaging(page, userId, msg.chat.id);
        let allListText = ''
        console.log("selectData", selectData);
        if (selectData.totalList.length > 0) {
            for (let i = 0; i < selectData.totalList.length; i++) {
                const res = selectData.totalList[i];
                // if (userId) {
                //     allListText += '*\n地址：*`' + res['address'] +
                //         '`*\n监控金额：' + res['monitoring_money'] +
                //         // '\n监控余额：' + res['monitoring_balance'] +
                //         '\n余额：' + res['balance'] + '\n*'
                // } else {
                //     allListText += '*\n地址：*`' + res['address'] +
                //         '`*\n监控金额：' + res['monitoring_money'] +
                //         // '\n监控余额：' + res['monitoring_balance'] +
                //         // '\n余额：' + res['balance'] +
                //         '\n操作人：' + (res['first_name'] ? res['first_name'] : '') + (res['last_name'] ? ' ' + res['last_name'] : '') + '\n*'
                // }
                const contractInfo = await this.getContractInfo(res['address'], 1);
                allListText += '*\n地址：*`' + res['address'] +
                    '`*\n监控金额：' + res['monitoring_money'] +
                    // '\n监控余额：' + res['monitoring_balance'] +
                    '\n价格：' + contractInfo['price'] +
                    '\n代币符号：' + contractInfo['symbol'] +
                    '\n操作人：' + (res['first_name'] ? res['first_name'] : '') + (res['last_name'] ? ' ' + res['last_name'] : '') + '\n*'

            }
            //总页数
            let totalPage = Math.ceil(selectData.totalNumber / 5)
            console.log('totalPage', totalPage)
            allListText += ('*\n共' + totalPage + '页，当前第' + (page + 1) + '页，共' + selectData.totalNumber + '个地址*')
            //仅一页
            let reply_markup = ''
            //第一页
            if (page === 0 && totalPage > 1) {
                reply_markup = JSON.stringify({
                    inline_keyboard: [
                        [{
                            text: '下一页➡️',
                            callback_data: 'problemsList_' + (page + 1)
                        },
                        {
                            text: '尾页↪️',
                            callback_data: 'problemsList_' + (totalPage - 1)
                        }]
                    ]
                })
                //最后一页
            } else if (page + 1 === totalPage && totalPage > 1) {
                reply_markup = JSON.stringify({
                    inline_keyboard: [
                        [{ text: '🏠首页', callback_data: 'problemsList_0' },
                        {
                            text: '◀️上一页',
                            callback_data: 'problemsList_' + (page - 1)
                        }]
                    ]
                })
            } else if (page > 0 && totalPage > 2) {
                console.log("sinboss", page, totalPage);
                reply_markup = JSON.stringify({
                    inline_keyboard: [
                        [{ text: '🏠首页', callback_data: 'problemsList_0' },
                        {
                            text: '◀️上一页',
                            callback_data: 'problemsList_' + (page - 1)
                        },
                        {
                            text: '下一页➡️',
                            callback_data: 'problemsList_' + (page + 1)
                        },
                        {
                            text: '尾页↪️',
                            callback_data: 'problemsList_' + (totalPage - 1)
                        }]
                    ]
                })
            }
            if (chat_id) {
                await bot.editMessageText(allListText, {
                    chat_id,
                    message_id: msg.message.message_id,
                    reply_markup,
                    'parse_mode': 'Markdown'
                });
            } else {
                await bot.sendMessage(msg.chat.id, allListText, {
                    'reply_to_message_id': msg.message_id,
                    reply_markup,
                    'parse_mode': 'Markdown'
                });
            }

        } else {
            await bot.sendMessage(msg.chat.id, '未添加任何地址', {
                'reply_to_message_id': msg.message_id
            });
        }
    }

    async getOrderHistory(address, msg) {
        // const CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
        // const { abi } = await this.ctx.app.tronWebTwo.trx.getContract(CONTRACT);
        // const contract = this.ctx.app.tronWebTwo.contract(abi.entrys, CONTRACT);
        // const balance = await contract.methods.balanceOf(address).call();
        // let orderText = '*\n地址：' + address + '' +
        //     '\n余额：' + (balance.toString() / 1000000) + '*'
        // let orderHistory = await this.axiosGet(this.ctx.app.config.apiUrl + '/v1/accounts/' + address + '/transactions/trc20?contract_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
        // if (orderHistory.data) {
        //     orderHistory.data.forEach(orderHistoryOnes => {
        //         let modified = "+"
        //         if (orderHistoryOnes.from === address) {
        //             modified = "-"
        //         }
        //         // console.log(orderHistoryOnes.value)
        //         let transferAmount = parseInt(orderHistoryOnes.value)
        //         // console.log(transferAmount > 0)
        //         if (transferAmount > 0) {
        //             orderText += ('\n`' + moment(orderHistoryOnes.block_timestamp).format('YYYY-MM-DD HH:mm') + ' ' + modified + (transferAmount / 1000000)) + '`   ' + '[查看详情](https://tronscan.org/#/transaction/' + orderHistoryOnes.transaction_id + ')'
        //         } else {
        //             orderText += ('\n`' + moment(orderHistoryOnes.block_timestamp).format('YYYY-MM-DD HH:mm') + ' ' + modified + transferAmount) + '`   ' + '[查看详情](https://tronscan.org/#/transaction/' + orderHistoryOnes.transaction_id + ')'
        //         }
        //     })
        // }
        // this.ctx.app.bot.sendMessage(msg.chat.id, orderText, {
        //     'reply_to_message_id': msg.message_id,
        //     'parse_mode': 'Markdown',
        //     'disable_web_page_preview': true
        // });
    }

    axiosGet(url) {
        const headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "TRON_PRO_API_KEY": this.ctx.app.config.apiKeyTwo,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36"
        }
        return new Promise((resolve) => {
            axios.get(url, { headers, }).then(function (response) {
                resolve(response.data)
            }).catch(function (error) {
                console.log(error)
                resolve()
            })
        })
    }
}

module.exports = bot;
