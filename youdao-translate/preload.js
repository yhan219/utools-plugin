const {clipboard} = require('electron')
const https = require('https');
const querystring = require('querystring');
const SHA256 = require("./sha256");
const errorCode = require("./error_code").errorCode

const noData = [{
    title: '没有数据',
    icon: './logo.png'
}]

const noAppId = [{
    title: '未设置app id，请阅读详情并按步骤设置',
    icon: './logo.png'
}]


const noAppSecret = [{
    title: '未设置app secret，请阅读详情并按步骤设置≤',
    icon: './logo.png'
}]

function truncate(q) {
    var len = q.length;
    if (len <= 20) return q;
    return q.substring(0, 10) + len + q.substring(len - 10, len);
}

function getFrom(searchWord) {
    const reg = /^[A-Za-z]+.*$/;
    if (reg.test(searchWord)) {
        return 'en'
    }
    return 'zh-CHS';
}

function getTo(from) {
    if (from === 'en') {
        return 'zh-CHS';
    }
    return 'en';
}


function handleSearch(searchWord, callbackSetList) {
    const appId = getAppId(callbackSetList);
    if (appId === '') {
        return
    }
    const appSecret = getAppSecret(callbackSetList);
    if (appSecret === '') {
        return
    }
    const salt = (new Date()).getTime();
    const curtime = Math.round(new Date().getTime() / 1000);
    const from = getFrom(searchWord);
    const to = getTo(from);
    // var to = 'en';
    const str1 = appId + truncate(searchWord) + salt + curtime + appSecret;

    const sign = SHA256(str1);
    const param = {
        q: searchWord,
        appKey: appId,
        salt: salt,
        from: from,
        to: to,
        sign: sign,
        signType: "v3",
        curtime: curtime
    };

    https.get({
            hostname: 'openapi.youdao.com',
            path: '/api?' + querystring.stringify(param),
            timeout: 30000
        }, (res) => {
            res.on('data', function (data) {
                let jsonData = JSON.parse(data);
                if (jsonData.errorCode !== '0') {
                    callbackSetList([{
                        title: errorCode.get(jsonData.errorCode),
                        description: '查询错误',
                        icon: './logo.png'
                    }])
                    return
                }
                let items = [];
                if (jsonData.translation) {
                    jsonData.translation.forEach(item => {
                        items.push({
                            title: item,
                            description: searchWord,
                            icon: './logo.png'
                        });
                    })
                }
                let exist = items.map(item => item.title);
                if (jsonData.web) {
                    jsonData.web.forEach(item => {
                        let desc = item.key;
                        item.value.forEach(v => {
                            if (exist.includes(v)) {
                                return
                            }
                            items.push({
                                title: v,
                                description: desc,
                                icon: './logo.png'
                            });
                        })
                    });
                }
                if (items.length === 0) {
                    callbackSetList(noData)
                    return
                }
                callbackSetList(items);
            });
        }
    )
    ;
}


String.prototype.resetBlank = function () {
    var regEx = /\s+/g;
    return this.replace(regEx, ' ');
};

const handleResult = function (itemData) {
    if (itemData.title) {
        clipboard.writeText(itemData.title, 'selection');
    }
};


const saveOrUpdateDb = function (key, data) {
    if (!data) {
        return
    }
    let keyData = window.utools.db.get(key);
    if (!keyData) {
        window.utools.db.put({
            _id: key,
            data: data
        })
        return
    }
    utools.db.put({
        _id: key,
        data: data,
        _rev: keyData._rev
    })
};

const getAppId = function (callbackSetList) {
    let appId = window.utools.db.get("app_id");
    if (!appId) {
        callbackSetList(noAppId)
        return ''
    }
    return appId.data
};

const getAppSecret = function (callbackSetList) {
    let appSecret = window.utools.db.get("app_secret");
    if (!appSecret) {
        callbackSetList(noAppSecret)
        return ''
    }
    return appSecret.data
};

window.exports = {
    "youdao-translate": {
        mode: "list",
        args: {
            // 进入插件时调用（可选）
            enter: (action, callbackSetList) => {
                if (action.type === 'over' && action.payload) {
                    handleSearch(action.payload, callbackSetList);
                }
            },
            // 子输入框内容变化时被调用 可选 (未设置则无搜索)
            search: (action, searchWord, callbackSetList) => {
                if (searchWord) {
                    handleSearch(searchWord, callbackSetList);
                }
            },
            // 用户选择列表中某个条目时被调用
            select: (action, itemData, callbackSetList) => {
                window.utools.hideMainWindow()
                handleResult(itemData)
                window.utools.outPlugin()
            },
            placeholder: "搜索回车复制"
        }
    },
    "youdao-app-id": {
        mode: "list",
        args: {
            enter: (action, callbackSetList) => {
                //显示当前app id
                let id = getAppId(callbackSetList);
                if (id !== '') {
                    callbackSetList([{
                        title: id,
                        description: '已设置',
                        icon: './logo.png'
                    }]);
                }
            },
            // 子输入框内容变化时被调用 可选 (未设置则无搜索)
            search: (action, searchWord, callbackSetList) => {
                saveOrUpdateDb('app_id', searchWord);
            },
            // 用户选择列表中某个条目时被调用
            select: (action, itemData, callbackSetList) => {
                window.utools.hideMainWindow()
                handleResult(itemData)
                window.utools.outPlugin()
            },
            placeholder: "输入appId自动保存"
        }
    },
    "youdao-app-secret": {
        mode: "list",
        args: {
            enter: (action, callbackSetList) => {
                //显示当前app id
                let secret = getAppSecret(callbackSetList);
                if (secret !== '') {
                    callbackSetList([{
                        title: secret,
                        description: '已设置',
                        icon: './logo.png'
                    }]);
                }
            },
            // 子输入框内容变化时被调用 可选 (未设置则无搜索)
            search: (action, searchWord, callbackSetList) => {
                saveOrUpdateDb("app_secret", searchWord);
            },
            // 用户选择列表中某个条目时被调用
            select: (action, itemData, callbackSetList) => {
                window.utools.hideMainWindow()
                handleResult(itemData)
                window.utools.outPlugin()
            },
            placeholder: "输入secret自动保存"
        }
    }
}