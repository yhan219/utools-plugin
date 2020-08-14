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
    if (history.length > 50) {
        history = history.slice(0, 50);
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

const handleSearch = function (searchWord, callbackSetList) {
    let items = getHistory()||[];
    if (searchWord) {
        items = items.filter(item => item.title.indexOf(searchWord) !== -1);
        items.unshift({
            title: searchWord
        });
    }
    if (items.length !== 0) {
        callbackSetList(items)
    }
};

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
            tell current session to write text "${itemData.title}"
        end tell
    end tell'`, (error, stdout, stderr) => {
        if (error) return window.utools.showNotification(stderr)
        window.utools.outPlugin()
    });
    addHistory(itemData)
};

window.exports = {
    "iterm_command": {
        mode: "list",
        args: {
            // 进入插件时调用（可选）
            enter: (action, callbackSetList) => {
                if (action.type === 'over' && action.payload) {
                    // 直接调用setSubInputValue不生效，特殊处理
                    setTimeout(function () {
                        window.utools.setSubInputValue(action.payload);
                    }, 50);
                } else {
                    let history = getHistory();
                    if (history) {
                        callbackSetList(history)
                    }
                }

            },
            // 子输入框内容变化时被调用 可选 (未设置则无搜索)
            search: (action, searchWord, callbackSetList) => {
                handleSearch(searchWord, callbackSetList)
            },
            // 用户选择列表中某个条目时被调用
            select: (action, itemData, callbackSetList) => {
                window.utools.hideMainWindow()
                execCommand(itemData)
                window.utools.outPlugin()
            },
            placeholder: "回车执行"
        }
    }
}