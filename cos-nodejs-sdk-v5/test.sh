#!/bin/bash

pwd
# 创建 bucket
node ../tools/tools.js create
cd ${Version}/
if [ ! -d "node_modules" ]; then
    echo "installing $PWD"
    tnpm init -y
    tnpm i 'cos-nodejs-sdk-v5@'${Version} --save
fi
echo "testing ${Version}"
outputPath='../output/nodejs-v'${Version}'.xml'

# 执行测试脚本
if [ $(uname -o) == "Msys" ]; then
    mocha && echo ""
else
	mocha --reporter xunit --reporter-options output=${outputPath} && echo ""
fi

echo "============================================"
cat ${outputPath}
echo "============================================"

# 删除 bucket
node ../../tools/tools.js clear
