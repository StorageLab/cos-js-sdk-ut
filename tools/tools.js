var COS = require('cos-nodejs-sdk-v5');
var command = process.argv[2];
var config = {
    Version: process.env.Version,
    SecretId: process.env.SecretId,
    SecretKey: process.env.SecretKey,
    AppId: process.env.AppId,
    Region: process.env.Region,
    Bucket: process.env.Bucket,
};

var cos = new COS({
    SecretId: config.SecretId,
    SecretKey: config.SecretKey,
    Protocol: 'http:',
});

var tools = {
    isBucketExist: function (opt, callback) {
        cos.headBucket(opt, function (err, data) {
            var isExist = data || (err && err.statusCode && Math.floor(err.statusCode / 100) === 2);
            callback(isExist);
        });
    },
    createBucket: function (opt, callback) {
        cos.putBucket(opt, function (err, data) {
            cos.putBucketCors({
                Bucket: opt.Bucket,
                Region: opt.Region,
                CORSConfiguration: {
                    "CORSRules": [{
                        "AllowedOrigin": ["*"],
                        "AllowedMethod": ["GET", "POST", "PUT", "DELETE", "HEAD"],
                        "AllowedHeader": ["*"],
                        "ExposeHeader": ["ETag", "x-cos-acl", "x-cos-version-id", "x-cos-delete-marker", "x-cos-server-side-encryption"],
                        "MaxAgeSeconds": "5"
                    }]
                }
            }, function (err, data) {
                tools.isBucketExist(opt, callback);
            });
        });
    },
    waitingForBucketDeleted: function (opt, callback) {
        var time0 = Date.now();
        var check = function () {
            tools.isBucketExist(opt, function (isExist) {
                if (!isExist || Date.now() - time0 > 5000) {
                    callback(isExist);
                } else {
                    setTimeout(function () {
                        check();
                    }, 250);
                }
            });
        };
        check();
    },
    clearBucket: function (opt, callback) {
        var removeBucket = function () {
            cos.abortUploadTask({
                Bucket: opt.Bucket,
                Region: opt.Region,
                Level: 'bucket',
            }, function (err, data) {
                cos.deleteBucketCors({
                    Bucket: opt.Bucket,
                    Region: opt.Region,
                }, function (err, data) {
                    cos.deleteBucket(opt, function (err, data) {
                        tools.waitingForBucketDeleted(opt, function (isExist) {
                            callback(!isExist);
                        });
                    });
                });
            });
        };
        var deleteObjectVersions = function () {
            cos.listObjectVersions({
                Bucket: opt.Bucket, // Bucket 格式：test-1250000000
                Region: opt.Region,
            }, function (err, data) {
                if (data && data.Versions && data.Versions.length) {
                    var count = data.Versions.length;
                    cos.putBucketVersioning({
                        Bucket: opt.Bucket, // Bucket 格式：test-1250000000
                        Region: opt.Region,
                        VersioningConfiguration: {
                            MFADelete: "Enabled",
                            Status: "Enabled"
                        }
                    }, function (e, d) {
                        data.Versions.forEach(function (item) {
                            cos.deleteObject({
                                Bucket: opt.Bucket, // Bucket 格式：test-1250000000
                                Region: opt.Region,
                                Key: item.Key,
                                VersionId: item.VersionId,
                            }, function (err, data) {
                                --count === 0 && removeBucket();
                                console.log('file version ' + item.Key + ' ' + item.VersionId + ' delete ' + (!err ? 'success' : 'error'));
                            });
                        });
                    });
                } else {
                    removeBucket();
                }
            })
        };
        tools.isBucketExist(opt, function (isExist) {
            if (!isExist) {
                callback(!isExist);
            } else {
                cos.getBucket({
                    Bucket: opt.Bucket,
                    Region: opt.Region,
                    Prefix: '',
                }, function (err, data) {
                    if (data && data.Contents && data.Contents.length) {
                        var count = data.Contents.length;
                        data.Contents.forEach(function (item) {
                            cos.deleteObject({
                                Bucket: opt.Bucket,
                                Region: opt.Region,
                                Key: item.Key,
                            }, function (err, data) {
                                console.log('file ' + item.Key + ' delete ' + (!err ? 'success' : 'error'));
                                --count === 0 && deleteObjectVersions();
                            });
                        });
                    } else {
                        deleteObjectVersions();
                    }
                });
            }
        });
    },
};


if (module.parent) {
    module.exports = tools;
} else {
    var BucketOption = {
        Bucket: config.Bucket,
        Region: config.Region,
    };
    if (command === 'create') {
        tools.createBucket(BucketOption, function (isSuccess) {
            console.log('Bucket ' + config.Bucket + ' create ' + (isSuccess ? 'success' : 'error') + '.');
        });
    } else if (command === 'clear') {
        tools.clearBucket(BucketOption, function (isSuccess) {
            console.log('Bucket ' + config.Bucket + ' clear and remove ' + (isSuccess ? 'success' : 'error') + '.');
        });
    } else if (command === 'clearOld') {
        cos.getService(function (err, data) {
            data.Buckets.forEach(function (item) {
                if (item.Name.indexOf('nodejsut') === 0) {
                    console.log(item.Name, item.Location);
                    tools.clearBucket({
                        Bucket: item.Name,
                        Region: item.Location || 'yfb',
                    }, function (isSuccess) {
                        console.log('Bucket ' + config.Bucket + ' clear and remove ' + (isSuccess ? 'success' : 'error') + '.');
                    });
                }
            })
        });
        // ['nodejsut226-', 'nodejsut206-', 'nodejsut208-', 'nodejsut226-', 'nodejsut226-', 'js5ut035-', 'js5ut037-'].forEach(function (BucketPrefix) {
        //     var Bucket = BucketPrefix + config.AppId;
        //     var Region = 'yfb';
        //     tool.clearBucket({
        //         Bucket: Bucket,
        //         Region: Region,
        //     }, function (isSuccess) {
        //         console.log('Bucket ' + config.Bucket + ' clear and remove ' + (isSuccess ? 'success' : 'error') + '.');
        //     });
        // });
    }
}