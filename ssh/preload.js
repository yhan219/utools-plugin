const spawn = require('child_process').spawn
const fs = require('fs')

const noData = [{
    title: '没有数据',
    icon: './logo.png'
}]

const noHostsFile = [{
    title: '没有hosts文件，请检查',
    icon: './logo.png'
}]

String.prototype.resetBlank = function () {
    var regEx = /\s+/g;
    return this.replace(regEx, ' ');
};

var handleResult = function (itemData) {
    if (itemData.description !== '') {
        exec(`ssh ${itemData.description}`)
    }
}

function handleHosts(searchWord, callbackSetList) {
    let hostsFilePath
    let utools = window.utools;
    if (utools.isMacOs() || utools.isLinux()) {
        hostsFilePath = "/etc/hosts";
    } else {
        hostsFilePath = "C:\\Windows\\System32\\drivers\\etc\\hosts"
    }
    if (!fs.existsSync(hostsFilePath)) {
        callbackSetList(noHostsFile)
        return;
    }

    const fileData = fs.readFileSync(hostsFilePath, 'utf-8');
    let dataLine = fileData.split(/[(\r\n)\r\n]+/);

    let searchNull = typeof searchWord == null || searchWord === null || searchWord === '' || searchWord === undefined;

    let hostsData = []

    dataLine.forEach(line => {
        if (!line || line.trim().startsWith("#")) {
            return
        }
        let resetBlank = line.trim().resetBlank();
        let split = resetBlank.split(' ');
        if (!split || split.length !== 2) {
            return
        }
        if (!searchNull && resetBlank.toLowerCase().indexOf(searchWord.trim().toLowerCase()) < 0) {
            return
        }
        hostsData.push({
            title: split[1],
            description: split[0],
            icon: './logo.png'
        });
    });
    if (hostsData.length === 0) {
        callbackSetList(noData)
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
                // handleHosts(null, callbackSetList)
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
            tell current session to write text "ls"
        end tell
    end tell'`, (error, stdout, stderr) => {
                    if (error) return window.utools.showNotification(stderr)
                    console.log(error)
                    window.utools.outPlugin()
                })
            },
            // 子输入框内容变化时被调用 可选 (未设置则无搜索)
            search: (action, searchWord, callbackSetList) => {


                // handleHosts(searchWord, callbackSetList)
            },
            // 用户选择列表中某个条目时被调用
            select: (action, itemData, callbackSetList) => {
                window.utools.hideMainWindow()
                handleResult(itemData)
                window.utools.outPlugin()
            },
            placeholder: "搜索/输入 回车执行"
        }
    }
}