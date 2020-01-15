#!/bin/bash

jsSdk=('0.3.7' '0.3.5')

if [ ! -d "node_modules" ]; then
    tnpm i
fi

for version in ${jsSdk[@]}
do
	cd ${version}/
	if [ ! -d "node_modules" ]; then
        echo "installing $PWD"
        tnpm init -y
        tnpm i 'cos-js-sdk-v5@'${version} --save
	fi
	cd ../
done

node ./test.js


