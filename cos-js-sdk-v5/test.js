const fs = require('fs');
const path = require('path');
const express = require('express');
const puppeteer = require('puppeteer');
const tools = require('../tools/tools');

// 启动静态服务器
var app = express();
app.use('/', express.static(__dirname));
app.listen(4005);

var versionList = ['0.3.5', '0.3.7'];

// 打开测试页面
puppeteer.launch({
    args: [
        '--no-proxy-server',
    ]
}).then(function (browser) {
    var pageCount = versionList.length;
    versionList.forEach(function (version) {
        var Bucket = ('js5ut' + version.replace('v', '') + process.env.Region).replace(/[_\-.]/g, '') + '-' + process.env.AppId;
        var config = {
            Version: version,
            SecretId: process.env.SecretId,
            SecretKey: process.env.SecretKey,
            AppId: process.env.AppId,
            Region: process.env.Region,
            Bucket: Bucket,
        };
        fs.writeFileSync(path.resolve(__dirname, `${version}/config.js`), 'var config = ' + JSON.stringify(config, null, '    '));
        tools.createBucket({Bucket: config.Bucket, Region: config.Region,}, function (isSuccess) {
            console.log('Bucket ' + config.Bucket + ' create ' + (isSuccess ? 'success' : 'error') + '.');
        });
        browser.newPage().then(function (page) {
            page.on('console', function (msg) {
                var text = msg.text();
                if (text === '[exit]') {
                    tools.clearBucket({Bucket: config.Bucket, Region: config.Region,}, function (isSuccess) {
                        console.log('Bucket ' + config.Bucket + ' clear and remove ' + (isSuccess ? 'success' : 'error') + '.');
                        if (--pageCount <= 0) {
                            browser.close();
                            process.exit();
                        }
                    });
                } else if (text.indexOf('[report]') === 0) {
                    var report = text.substr('[report]'.length);
                    console.log(report);
                    fs.writeFileSync(path.resolve(__dirname, `./output/js5-v${version}.xml`), report);
                } else {
                    console.log(text);
                }
            });
            page.goto(`http://127.0.0.1:4005/${version}/index.html`);
        });
    });
});