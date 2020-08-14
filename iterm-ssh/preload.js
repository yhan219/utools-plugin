const fs = require('fs')

const noHostsFile = {
    description: '没有hosts文件，请检查'
}

String.prototype.resetBlank = function () {
    var regEx = /\s+/g;
    return this.replace(regEx, ' ');
};

String.prototype.endWith = function (s) {
    var d = this.length - s.length;
    return (d >= 0 && this.lastIndexOf(s) == d)
}


function dateFormat(fmt, date) {
    let ret;
    const opt = {
        "Y+": date.getFullYear().toString(),        // 年
        "m+": (date.getMonth() + 1).toString(),     // 月
        "d+": date.getDate().toString(),            // 日
        "H+": date.getHours().toString(),           // 时
        "M+": date.getMinutes().toString(),         // 分
        "S+": date.getSeconds().toString()          // 秒
        // 有其他格式化字符需求可以继续添加，必须转化成字符串
    };
    for (let k in opt) {
        ret = new RegExp("(" + k + ")").exec(fmt);
        if (ret) {
            fmt = fmt.replace(ret[1], (ret[1].length === 1) ? (opt[k]) : (opt[k].padStart(ret[1].length, "0")))
        }
    }
    return fmt;
}


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

const addHistory = item => {
    if (!item) {
        return
    }
    let title = item.title;
    item.description = dateFormat("mm-dd HH:MM:SS", new Date())

    let history = getHistory() || [];
    let index = -1;
    for (let i = 0; i < history.length; i++) {
        if (history[i].title === title) {
            index = i;
        }
    }
    if (index !== -1) {
        history.splice(index, 1);
    }
    history.unshift(item);
    if (history.length > 5) {
        history = history.slice(0, 5);
    }
    saveOrUpdateDb('history', history);
};

const getHistory = function () {
    let history = window.utools.db.get("history");
    if (history) {
        return history.data
    }
    return history;
}


const execCommand = function (itemData) {
    if (!itemData || !itemData.title) {
        return
    }
    require('child_process').exec(`osascript -e 'tell application "iTerm"
        activate
        try
            select first window
            set onlywindow to true
        on error
            create window with default profile
            select first window
            set onlywindow to true
        end try
        tell the first window
            if onlywindow is false then
                create tab with default profile
            end if
            tell current session to write text "ssh ${itemData.title}"
        end tell
    end tell'`, (error, stdout, stderr) => {
        if (error) return window.utools.showNotification(stderr)
        window.utools.outPlugin()
    });
    addHistory(itemData)
};


/**
 * 从关键字中提取host
 * 几种情况
 * ssh -p22 root@ip
 * ssh -p 22 root@ip
 * ssh ip1
 * @param searchWord
 */
function getHost(searchWord) {
    if (!searchWord) {
        return null;
    }
    if (searchWord.endWith('@')) {
        return null;
    }
    let split = searchWord.split(' ');
    if (split.length === 0) {
        return null
    }
    let endWord = split[split.length - 1];
    if (endWord.indexOf("@") !== -1) {
        //ssh root@ip
        return endWord.split('@')[1]
    }
    if (endWord.indexOf('-') !== -1) {
        //如果最后一个是-p这样的参数
        return null;
    }
    return endWord

}

function handleHosts(searchWord, callbackSetList) {
    let hostsFilePath = "/etc/hosts";
    let hostsData = (getHistory() || [])
        .filter(item => !searchWord || item.title.indexOf(searchWord) !== -1);
    if (!fs.existsSync(hostsFilePath)) {
        hostsData.unshift({
            title: searchWord
        }, noHostsFile);
        callbackSetList(hostsData)
        return;
    }

    const fileData = fs.readFileSync(hostsFilePath, 'utf-8');
    let dataLine = fileData.split(/[(\r\n)\r\n]+/);
    let host = getHost(searchWord);
    console.log(host)

    dataLine.forEach(line => {
        if (!line || line.trim().startsWith("#")) {
            return
        }
        let resetBlank = line.trim().resetBlank();
        let split = resetBlank.split(' ');
        if (!split || split.length !== 2) {
            return
        }
        if (!host && !searchWord) {
            hostsData.push({
                title: split[1].resetBlank(),
                description: split[0]
            });
            return
        }
        if (host && resetBlank.indexOf(host) === -1) {
            return;
        }
        let end = searchWord.lastIndexOf(host);
        if (end === -1) {
            end = searchWord.length
        }
        let title = `${searchWord.substring(0, end)} ${split[1]}`;
        hostsData.push({
            title: title.resetBlank().replace("@ ","@"),
            description: split[0]
        });
    });
    if (hostsData.length === 0) {
        if (searchWord) {
            callbackSetList([{
                title: searchWord
            }]);
        }
        return
    }
    callbackSetList(hostsData)
}


window.exports = {
    "ssh_hosts": {
        mode: "list",
        args: {
            // 进入插件时调用（可选）
            enter: (action, callbackSetList) => {
                handleHosts(null, callbackSetList)
            },
            // 子输入框内容变化时被调用 可选 (未设置则无搜索)
            search: (action, searchWord, callbackSetList) => {
                handleHosts((searchWord || '').resetBlank(), callbackSetList)
            },
            // 用户选择列表中某个条目时被调用
            select: (action, itemData, callbackSetList) => {
                console.log(action)
                console.log(itemData)

                window.utools.hideMainWindow()
                execCommand(itemData)
                window.utools.outPlugin()
            },
            placeholder: "搜索/输入 回车执行"
        }
    }
}