'use strict';
const TelegramBot = require('node-telegram-bot-api');
const moment = require('moment');
const TronWeb = require('tronweb');
const getNickname = (msg) => {
    return (msg.from.first_name ? msg.from.first_name : '') + (msg.from.last_name ? ' ' + msg.from.last_name : '');
};
const { Connection, PublicKey } = require("@solana/web3.js");
function htmlEncodeByRegExp(str) {
    var temp = '';
    if (str.length < 1) return '';
    temp = str.replace(/&/g, '&amp;');
    temp = temp.replace(/</g, '&lt;');
    temp = temp.replace(/>/g, '&gt;');
    temp = temp.replace(/'/g, '&#39;');
    temp = temp.replace(/"/g, '&quot;');
    return temp;
}
function isAddress(str) {
    try {
        new PublicKey(str); // 如果地址不合法，这里会抛出错误
        return true;
    } catch (e) {
        return false;
    }
}
const reply_markup = JSON.stringify({
    inline_keyboard: [
        [{
            text: '确认',
            callback_data: 'sendMess'
        }, {
            text: '取消',
            callback_data: 'cancelSendMess'
        }]
    ]
})
async function sync_block(ctx) {
    await ctx.service.bot.getBlock().catch(e => {
        ctx.logger.error(e)
    })
    setTimeout(() => {
        sync_block(ctx)
    }, 1000);
}
async function get_user(ctx, msg) {
    let user = await ctx.model.user.getUserById(msg.from.id);
    if (!user) { //不存在则注册
        let user = {
            id: msg.from.id,
            is_bot: msg.from.is_bot,
            is_admin: 0,
            first_name: msg.from.first_name,
            last_name: msg.from.last_name,
            username: msg.from.username,
            add_time: msg.date
        };
        await ctx.model.user.addUser(user);
    } else {
        let updateUser = {};
        if (user.first_name !== msg.from.first_name) {
            updateUser['first_name'] = msg.from.first_name
        }
        if (user.last_name !== msg.from.last_name) {
            updateUser['last_name'] = msg.from.last_name
        }
        if (user.username !== msg.from.username) {
            updateUser['username'] = msg.from.username
        }
        if (updateUser) {
            await ctx.model.user.updateUser(user, msg.from.id);
        }
    }
    return user;
}

module.exports = app => {
    const ctx = app.createAnonymousContext();
    app.connection = new Connection(app.config.rpc);
    app.ws = null;
    app.addressArray = [];
    app.addressList = [];
    app.ws_request_id = 0;
    if (app.config.sending == 1) {

        const bot = new TelegramBot(app.config.botToken, {
            polling: {
                interval: 5000,  // 5 秒轮询一次
                timeout: 10,     // 超时时间 10 秒
                autoStart: true, // 自动启动 polling
            },
        });

        bot.on('text', async (msg) => {
            //私聊
            // console.log(msg)
            //超时5秒不回复
            if (Date.now() / 1000 > msg.date + 3600) {
                return;
            }
            let text = msg.text;
            if (text) {
                text = htmlEncodeByRegExp(text.trim());
            } else {
                return;
            }
            // 非私聊
            // if (msg.chat.id !== msg.from.id) {
            // }        
            // 私聊
            // const ctx = app.createAnonymousContext();
            //写入消息记录防止消息重复
            let data = await ctx.model.user.getMessage(msg.chat.id, msg.message_id);
            if (data) {
                return;
            } else {
                await ctx.model.user.addMessage({
                    message_id: msg.message_id,
                    text,
                    uid: msg.from.id,
                    chat_id: msg.chat.id,
                    add_time: msg.date
                });
            }

            //获取发送的用户
            let user = await get_user(ctx, msg)
            //禁用用户不回复
            if (user.status === 0) return;
            // 首次时候
            if (new RegExp(/\/start/).test(text)) {
                let reply_markup = { keyboard: [["添加监控数据", "删除地址监控", "查看监控数据", "修改金额"]], resize_keyboard: true }
                await bot.sendMessage(msg.chat.id, '您好！', {
                    'reply_to_message_id': msg.message_id,
                    'parse_mode': 'Markdown',
                    reply_markup
                });
                // }
                return;
            }
            if (new RegExp(/^修改金额$/).test(text)) {
                await bot.sendMessage(msg.chat.id, '*修改金额请按照下列格式：*\n/money 转账预警额度(数字)' +
                    '\n\n/money 1000', {
                    'reply_to_message_id': msg.message_id,
                    'parse_mode': 'Markdown'
                });
                return;
            }

            if (new RegExp(/^删除地址监控$/).test(text)) {
                await bot.sendMessage(msg.chat.id, '*删除地址请按照下列格式：*\n/del SOLANA地址' +
                    '\n\n/del 626YjgbR1kS37oyjGzNcM4opF7RbcyzqbQof6Ejcts8k', {
                    'reply_to_message_id': msg.message_id,
                    'parse_mode': 'Markdown'
                });
                return;
            }
            if (new RegExp(/^查看监控数据$/).test(text)) {
                await ctx.service.bot.getAllAddress(bot, ctx, msg)
                return;
            }
            // 添加监控数据
            if (new RegExp(/^添加监控数据$/).test(text)) {
                let returnText = '*添加地址请按照下列格式：*\n/add\nSOLANA地址 转账预警额度(数字)' +
                    '\n\n/add\n626YjgbR1kS37oyjGzNcM4opF7RbcyzqbQof6Ejcts8k 1000\n\n' +
                    '*支持批量添加：*：\n\n/add\n626YjgbR1kS37oyjGzNcM4opF7RbcyzqbQof6Ejcts8k 1000\n626YjgbR1kS37oyjGzNcM4opF7RbcyzqbQof6Ejcts8k 1000\n\n金额可有可无'
                await bot.sendMessage(msg.chat.id, returnText, {
                    'reply_to_message_id': msg.message_id,
                    'parse_mode': 'Markdown'
                });
                return;
            }


            // 修改金额
            if (new RegExp((/^\/money/)).test(text)) {
                let matchList = text.split(' ');

                if (matchList.length === 2) {
                    if (matchList[0] === '/money') {
                        let money = matchList[1]
                        let changeText = await ctx.model.monitoringAddress.updateChatMoney(money, msg.chat.id);
                        // console.log("金额修改", matchList.length, matchList[0], changeText);
                        ctx.service.bot.refreshAddressList();
                        bot.sendMessage(msg.chat.id, changeText, {
                            'reply_to_message_id': msg.message_id,
                            'parse_mode': 'Markdown'
                        });
                    }
                }
                return;
            }
            // 删地址
            if (new RegExp((/^\/del/)).test(text)) {
                let matchList = text.split(' ');
                if (matchList.length === 2 && matchList[0] === '/del') {
                    let resText = ''
                    // if (user.is_admin === 1) {
                    //     resText = await ctx.model.monitoringAddress.delAddress(matchList[1], '', msg.chat.id);
                    // } else {
                    //     resText = await ctx.model.monitoringAddress.delAddress(matchList[1], msg.from.id, msg.chat.id);
                    // }                
                    resText = await ctx.model.monitoringAddress.delAddress(matchList[1], '', msg.chat.id);
                    ctx.service.bot.removeListening(matchList[1]);
                    bot.sendMessage(msg.chat.id, resText, {
                        'reply_to_message_id': msg.message_id,
                        'parse_mode': 'Markdown'
                    });
                }
                return;
            }

            // 添加地址 --剩下的都是 添加地址
            // if (new RegExp(/^\/add/).test(text)) {
            let matchList = text.split('\n')
            let complianceAddressData = []
            let complianceAddressList = new Set();
            let addressCount = 0
            // if (matchList.length >= 1 && matchList[0] === '/add') {
            // matchList = matchList.slice(1)
            matchList.forEach(matchOnes => {
                let matchOnesList = matchOnes.split(' ')
                if (matchOnesList.length >= 1) {
                    let address = matchOnesList[0]
                    let monitoring_money = 0.1;
                    if (matchOnesList.length > 1) monitoring_money = parseInt(matchOnesList[1]);
                    // let monitoring_balance = parseInt(matchOnesList[2])
                    let monitoring_balance = 1000;
                    if (isAddress(address) && monitoring_money > 0 && monitoring_balance > 0) {
                        if (!complianceAddressList.has(address)) {
                            complianceAddressList.add(address)
                            addressCount += 1
                            complianceAddressData.push({
                                address,
                                chat_id: msg.chat.id,
                                monitoring_money,
                                monitoring_balance,
                                'user_id': msg.from.id
                            })
                        }
                    }
                }
            })
            if (complianceAddressData.length > 0) {
                ctx.service.bot.addAddressList(complianceAddressData)
            }
            let complianceAddressListT = JSON.stringify(complianceAddressList)
            if (complianceAddressListT.length > 0 && addressCount>0) {
                text = '添加监控成功，本次添加地址：' + addressCount
                bot.sendMessage(msg.chat.id, text, {
                    'parse_mode': 'Markdown'
                });
                return
            }
            // }
            // bot.sendMessage(msg.chat.id, '添加地址失败', {
            //     'parse_mode': 'Markdown'
            // });
            // return;
            // }
        });


        bot.on('callback_query', async (msg) => {
            // console.log(msg)
            const ctx = app.createAnonymousContext();
            //获取用户
            let user = await get_user(ctx, msg)
            let splitKey = msg.data.split('_')
            // console.log("splitKey", splitKey);
            if (splitKey.length > 1 && splitKey[0] === 'problemsList') {
                // if (user.is_admin === 1) {
                //     await ctx.service.bot.getAllAddress(bot, ctx, msg, msg.message.chat.id, parseInt(splitKey[1]))
                // } else {
                // await ctx.service.bot.getAllAddress(bot, ctx, msg, msg.message.chat.id, parseInt(splitKey[1]), msg.from.id)
                // }
                await ctx.service.bot.getAllAddress(bot, ctx, msg, msg.message.chat.id, parseInt(splitKey[1]))
                return;
            }
            if (splitKey.length > 1 && splitKey[0] === 'userList') {
                await ctx.service.bot.getUserList(bot, ctx, msg, msg.message.chat.id, parseInt(splitKey[1]))
                return;
            }
            if (splitKey.length > 1 && splitKey[0] === 'userKeypad') {
                if (user.is_admin === 1) {
                    await ctx.service.bot.getUserListKeypad(bot, ctx, msg, parseInt(splitKey[1]))
                }
                return;
            }
            switch (msg.data) {
                case 'sendMess':
                    ctx.service.bot.getUserListKeypad(bot, ctx, msg)
                    break
                case 'cancelSendMess':
                    bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
                    break
                default:
                    try {
                        let res
                        if ((msg.message.reply_to_message).hasOwnProperty('photo')) {
                            res = await bot.sendPhoto(msg.data, msg.message.reply_to_message.photo[0]['file_id']).catch(e => {
                                return e.response.body
                            });
                        } else if ((msg.message.reply_to_message).hasOwnProperty('sticker')) {
                            res = await bot.sendAnimation(msg.data, msg.message.reply_to_message.sticker['file_id']).catch(e => {
                                return e.response.body
                            });
                        } else {
                            res = await bot.sendMessage(msg.data, msg.message.reply_to_message.text).catch(e => {
                                return e.response.body
                            });
                        }
                        if (res.hasOwnProperty('description')) {
                            bot.editMessageText('发送失败！失败原因：\n' + res['description'], {
                                chat_id: msg.message.chat.id,
                                message_id: msg.message.message_id,
                                'reply_to_message_id': msg.message_id
                            });
                        } else {
                            bot.editMessageText('消息已发送！', {
                                chat_id: msg.message.chat.id,
                                message_id: msg.message.message_id,
                                'reply_to_message_id': msg.message_id
                            });
                        }
                    } catch (e) {
                        console.log(e)
                        bot.editMessageText('发送失败！', {
                            chat_id: msg.message.chat.id,
                            message_id: msg.message.message_id,
                            'reply_to_message_id': msg.message_id
                        });
                    }
                    break
            }
        })
        bot.on('message', async (msg) => {
            if (msg.hasOwnProperty('sticker') || msg.hasOwnProperty('photo')) {
                if (String(msg.chat.id) === app.config.chatAdminID) {
                    bot.sendMessage(app.config.chatAdminID, '转发这条消息？', {
                        'reply_to_message_id': msg.message_id,
                        reply_markup
                    });
                }
            }
        })
        bot.on("polling_error", (error) => {
            console.log("❌ Polling 错误:", error);
        });

        app.bot = bot;
    }
    // setTimeout(() => {
    //     const ctx = app.createAnonymousContext();
    //     const json = JSON.parse('[{"block":{"blockHeight":336661156,"blockTime":1754573218,"blockhash":"A7JjzqEwTcenuZkt53xZ6QbiWU6Bb13kfMNmDE32cjnf","parentSlot":358474570,"previousBlockhash":"6wfcBA8v7yoVwNqXoWschwrwfUZsVjXjnB3Utypjmoyc","rewards":[{"commission":null,"lamports":12036019,"postBalance":51700370239,"pubkey":"CPcDFHCAKkr5Kp9T5aQWJhXV5J6iFj141NMQ87L6poPL","rewardType":"Fee"}],"slot":358474571},"transactions":[{"raw":{"meta":{"computeUnitsConsumed":73859,"err":null,"fee":9428,"innerInstructions":[{"index":2,"instructions":[{"accounts":["CKuBSvFZjqAKvzYignAG4DFcqAE5JcwDCMadfQo2y8bW","9iFER3bpjf1PTTCQCfTRu17EJgvsxo9pVyA9QWwEuX4x","EJELT5qeMyZo2unrErwFcfitcRENWQUnV8da8XCGczZc","BrZNFdYGM2ZhznprzfrPuDwQ7MmaeaYgzbbfvRs8w4ou","68dqn4f3UEPBUbaaWRX9z6FHfY6rNvo8EBT4s8JKAYhJ","5Vwuoa4xThpinv54Crb3eBqckKN3q6oPCULZsP1GRH8J","3eM31339YnT6XHzUx6dVZKfJ3vhpCaPTvdPD25Hhghqw","2UWFfy4PVfZEm6S7dsKguJ4fW9fDyrNmYBw1x1SEk4NX","TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","BygqUnNXZ1r4LYu5dMCxgWgm4Um1488jXtneV1rQAgGR","JAiZuqEDFMTioXg3NgoepBAjnX95KUbZhoioS43YSzuF"],"data":"wZRp7wZ3czsoxxoWSeQNtrDuPDsVxEpyNgCd7SAszxdhhBzeCUmU1HBE","programId":"CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK","stackHeight":2},{"parsed":{"info":{"amount":"1000000","authority":"CKuBSvFZjqAKvzYignAG4DFcqAE5JcwDCMadfQo2y8bW","destination":"5Vwuoa4xThpinv54Crb3eBqckKN3q6oPCULZsP1GRH8J","source":"BrZNFdYGM2ZhznprzfrPuDwQ7MmaeaYgzbbfvRs8w4ou"},"type":"transfer"},"program":"spl-token","programId":"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","stackHeight":3},{"parsed":{"info":{"amount":"12445641","authority":"EJELT5qeMyZo2unrErwFcfitcRENWQUnV8da8XCGczZc","destination":"68dqn4f3UEPBUbaaWRX9z6FHfY6rNvo8EBT4s8JKAYhJ","source":"3eM31339YnT6XHzUx6dVZKfJ3vhpCaPTvdPD25Hhghqw"},"type":"transfer"},"program":"spl-token","programId":"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","stackHeight":3},{"accounts":["D8cy77BBepLMngZx6ZukaTff5hCt1HrWyKk3Hnd9oitf"],"data":"QMqFu4fYGGeUEysFnenhAvi1xPm726vLbPnsuyPY5Jr6BfJygEDcWLKrWxu3qzgfNTG7HkS8xcYNcpMebZxzVcQiGc8rAcDCUqdSsP7uj3aESdPJYswkR7vTUt1FumCFom398D87sJEhTCLkwLu4cU8gppEy9AEABNS56PwGEENHBkj","programId":"JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4","stackHeight":2}]}],"logMessages":["Program ComputeBudget111111111111111111111111111111 invoke [1]","Program ComputeBudget111111111111111111111111111111 success","Program ComputeBudget111111111111111111111111111111 invoke [1]","Program ComputeBudget111111111111111111111111111111 success","Program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 invoke [1]","Program log: Instruction: Route","Program CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK invoke [2]","Program log: Instruction: Swap","Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [3]","Program log: Instruction: Transfer","Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA consumed 4645 of 39594 compute units","Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success","Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [3]","Program log: Instruction: Transfer","Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA consumed 4690 of 32289 compute units","Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success","Program data: QMbN6CYIceLFkeHSNPcpcbbCa4/K9TuB0lQ2lw/mhzNMKin9vgBzr6hIAtD4e2Fo95jX8XljAmO5x+BefkChSIu2j6e4Z9EdTD8oEht/v0zZknyjwmZLJfR9OfdtCAsg4T+Zl9nMJmWhRuz84WSrV0PYEuSPIk0WK2kg1wl9HzA/MNJrOCJnrMnnvQAAAAAAAAAAAAAAAABAQg8AAAAAAAAAAAAAAAAAADBBIrAB249IAAAAAAAAAADi/7DY+2nqiQYAAAAAAAAAgJ3//w==","Program CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK consumed 64464 of 86881 compute units","Program CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK success","Program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 invoke [2]","Program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 consumed 184 of 20764 compute units","Program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 success","Program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 consumed 73559 of 92610 compute units","Program return: JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 yee9AAAAAAA=","Program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 success"],"postBalances":[108603476,2039280,2039280,1,1461600,2710760855,32092560,2039280,2039280,72161280,11637120,13641600,3592992,0,4534961825,1705408,1844541650],"postTokenBalances":[{"accountIndex":1,"mint":"FN27M5GR4Pe4rRvJ2y6S8MHBPBt8yDo62xwf9JjVFVG","owner":"CKuBSvFZjqAKvzYignAG4DFcqAE5JcwDCMadfQo2y8bW","programId":"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","uiTokenAmount":{"amount":"12432254300688","decimals":6,"uiAmount":12432254.300688,"uiAmountString":"12432254.300688"}},{"accountIndex":2,"mint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","owner":"CKuBSvFZjqAKvzYignAG4DFcqAE5JcwDCMadfQo2y8bW","programId":"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","uiTokenAmount":{"amount":"2995499","decimals":6,"uiAmount":2.995499,"uiAmountString":"2.995499"}},{"accountIndex":7,"mint":"FN27M5GR4Pe4rRvJ2y6S8MHBPBt8yDo62xwf9JjVFVG","owner":"EJELT5qeMyZo2unrErwFcfitcRENWQUnV8da8XCGczZc","programId":"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","uiTokenAmount":{"amount":"21275602836035991","decimals":6,"uiAmount":21275602836.03599,"uiAmountString":"21275602836.035991"}},{"accountIndex":8,"mint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","owner":"EJELT5qeMyZo2unrErwFcfitcRENWQUnV8da8XCGczZc","programId":"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","uiTokenAmount":{"amount":"5745753","decimals":6,"uiAmount":5.745753,"uiAmountString":"5.745753"}}],"preBalances":[108612904,2039280,2039280,1,1461600,2710760855,32092560,2039280,2039280,72161280,11637120,13641600,3592992,0,4534961825,1705408,1844541650],"preTokenBalances":[{"accountIndex":1,"mint":"FN27M5GR4Pe4rRvJ2y6S8MHBPBt8yDo62xwf9JjVFVG","owner":"CKuBSvFZjqAKvzYignAG4DFcqAE5JcwDCMadfQo2y8bW","programId":"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","uiTokenAmount":{"amount":"12432241855047","decimals":6,"uiAmount":12432241.855047,"uiAmountString":"12432241.855047"}},{"accountIndex":2,"mint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","owner":"CKuBSvFZjqAKvzYignAG4DFcqAE5JcwDCMadfQo2y8bW","programId":"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","uiTokenAmount":{"amount":"3995499","decimals":6,"uiAmount":3.995499,"uiAmountString":"3.995499"}},{"accountIndex":7,"mint":"FN27M5GR4Pe4rRvJ2y6S8MHBPBt8yDo62xwf9JjVFVG","owner":"EJELT5qeMyZo2unrErwFcfitcRENWQUnV8da8XCGczZc","programId":"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","uiTokenAmount":{"amount":"21275602848481632","decimals":6,"uiAmount":21275602848.481632,"uiAmountString":"21275602848.481632"}},{"accountIndex":8,"mint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","owner":"EJELT5qeMyZo2unrErwFcfitcRENWQUnV8da8XCGczZc","programId":"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","uiTokenAmount":{"amount":"4745753","decimals":6,"uiAmount":4.745753,"uiAmountString":"4.745753"}}],"returnData":{"data":["yee9AAAAAAA=","base64"],"programId":"JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"},"rewards":[],"status":{"Ok":null}},"transaction":{"message":{"accountKeys":[{"pubkey":"CKuBSvFZjqAKvzYignAG4DFcqAE5JcwDCMadfQo2y8bW","signer":true,"source":"transaction","writable":true},{"pubkey":"68dqn4f3UEPBUbaaWRX9z6FHfY6rNvo8EBT4s8JKAYhJ","signer":false,"source":"transaction","writable":true},{"pubkey":"BrZNFdYGM2ZhznprzfrPuDwQ7MmaeaYgzbbfvRs8w4ou","signer":false,"source":"transaction","writable":true},{"pubkey":"ComputeBudget111111111111111111111111111111","signer":false,"source":"transaction","writable":false},{"pubkey":"FN27M5GR4Pe4rRvJ2y6S8MHBPBt8yDo62xwf9JjVFVG","signer":false,"source":"transaction","writable":false},{"pubkey":"JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4","signer":false,"source":"transaction","writable":false},{"pubkey":"2UWFfy4PVfZEm6S7dsKguJ4fW9fDyrNmYBw1x1SEk4NX","signer":false,"source":"lookupTable","writable":true},{"pubkey":"3eM31339YnT6XHzUx6dVZKfJ3vhpCaPTvdPD25Hhghqw","signer":false,"source":"lookupTable","writable":true},{"pubkey":"5Vwuoa4xThpinv54Crb3eBqckKN3q6oPCULZsP1GRH8J","signer":false,"source":"lookupTable","writable":true},{"pubkey":"BygqUnNXZ1r4LYu5dMCxgWgm4Um1488jXtneV1rQAgGR","signer":false,"source":"lookupTable","writable":true},{"pubkey":"EJELT5qeMyZo2unrErwFcfitcRENWQUnV8da8XCGczZc","signer":false,"source":"lookupTable","writable":true},{"pubkey":"JAiZuqEDFMTioXg3NgoepBAjnX95KUbZhoioS43YSzuF","signer":false,"source":"lookupTable","writable":true},{"pubkey":"D8cy77BBepLMngZx6ZukaTff5hCt1HrWyKk3Hnd9oitf","signer":false,"source":"lookupTable","writable":false},{"pubkey":"jitodontfront1111111111111111JustUseJupiter","signer":false,"source":"lookupTable","writable":false},{"pubkey":"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","signer":false,"source":"lookupTable","writable":false},{"pubkey":"9iFER3bpjf1PTTCQCfTRu17EJgvsxo9pVyA9QWwEuX4x","signer":false,"source":"lookupTable","writable":false},{"pubkey":"CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK","signer":false,"source":"lookupTable","writable":false}],"addressTableLookups":[{"accountKey":"3oy9ojnsDzqmMNi87Gs7Hn5v3MPVqnWjG9k8BmzKR7yW","readonlyIndexes":[0,2,20],"writableIndexes":[]},{"accountKey":"6mckVskNBAQyVQ6y4BRRccQvc7ditxuQgkh6ARkKL6Do","readonlyIndexes":[28,9],"writableIndexes":[70,66,67,205,202,68]}],"instructions":[{"accounts":[],"data":"LBXKUj","programId":"ComputeBudget111111111111111111111111111111","stackHeight":null},{"accounts":[],"data":"3KGTHYGxF86b","programId":"ComputeBudget111111111111111111111111111111","stackHeight":null},{"accounts":["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","CKuBSvFZjqAKvzYignAG4DFcqAE5JcwDCMadfQo2y8bW","BrZNFdYGM2ZhznprzfrPuDwQ7MmaeaYgzbbfvRs8w4ou","68dqn4f3UEPBUbaaWRX9z6FHfY6rNvo8EBT4s8JKAYhJ","JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4","FN27M5GR4Pe4rRvJ2y6S8MHBPBt8yDo62xwf9JjVFVG","JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4","D8cy77BBepLMngZx6ZukaTff5hCt1HrWyKk3Hnd9oitf","JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4","CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK","CKuBSvFZjqAKvzYignAG4DFcqAE5JcwDCMadfQo2y8bW","9iFER3bpjf1PTTCQCfTRu17EJgvsxo9pVyA9QWwEuX4x","EJELT5qeMyZo2unrErwFcfitcRENWQUnV8da8XCGczZc","BrZNFdYGM2ZhznprzfrPuDwQ7MmaeaYgzbbfvRs8w4ou","68dqn4f3UEPBUbaaWRX9z6FHfY6rNvo8EBT4s8JKAYhJ","5Vwuoa4xThpinv54Crb3eBqckKN3q6oPCULZsP1GRH8J","3eM31339YnT6XHzUx6dVZKfJ3vhpCaPTvdPD25Hhghqw","2UWFfy4PVfZEm6S7dsKguJ4fW9fDyrNmYBw1x1SEk4NX","TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","BygqUnNXZ1r4LYu5dMCxgWgm4Um1488jXtneV1rQAgGR","JAiZuqEDFMTioXg3NgoepBAjnX95KUbZhoioS43YSzuF","JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4","jitodontfront1111111111111111JustUseJupiter"],"data":"PrpFmsY4d26dKbdKMZJ1NKtnWzMN7yQSdjAwjZadVygCjouZ","programId":"JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4","stackHeight":null}],"recentBlockhash":"WpFq1ohoRW27NDz9pgrKjvZJSorZJJQTb3tiMfX2cWp"},"signatures":["xNUojk294upptyzsbk4XK8mDpRGRhzsZF3K75xCAFwcxPRT2LKUGsjF7m9J1C22dr4rb29vYodjXJWyJz5it82A"]},"version":0},"wallets":["EJELT5qeMyZo2unrErwFcfitcRENWQUnV8da8XCGczZc"]}]}]');
    //     ctx.service.bot.handleTransaction(json);
    // }, 1000)
    setTimeout(() => {
        try {
            // ctx.service.bot.solanaListener();                        
            ctx.service.bot.addPoolWebhook();    
            // if (app.config.sending == 1) {
            //     ctx.service.bot.sendTongzhi();
            // }            
            console.log("执行 setTimeout 任务");
        } catch (error) {
            console.error("❌ setTimeout 发生错误:", error);
        }

        // sync_block(ctx);
    }, 1000);
    // 一个小时一次
    setInterval(()=>{        
        ctx.service.bot.addPoolWebhook();
    }, 3600 * 1000 * 3);

    app.once('server', () => {
        console.log('server start');
    });

    app.on('error', err => {
        console.error(err);
    });
    app.on('request', () => {
        // if (app.config.env === 'local') {
        // console.log(1);
        // }
    });
    app.on('response', ctx => {
        // if (app.config.env === 'local') {
        console.log(ctx.method + ' ' + ctx.path + ' ' + JSON.stringify(ctx.request.body));
        const used = Date.now() - ctx.starttime;
        console.log('      \u001b[33mused time: \u001b[39m', used);
        // }
    });

};
