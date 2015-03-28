'use strict';

/* globals _vc */

require('./argv-parser');

var fs = require('fs');
var Path = require('path');

var DBVideo = require('./db-video');
var VideoUtils = require('./ffmpeg-runner');
var logger = require('./logger');

process.on('uncaughtException', function(e) {
    logger.critical(__filename, 'Global Error Caught', e);
});

var fileName = process.argv[process.argv.length - 1];

if (!fileName) {
    logger.critical('Filename is empty');
    process.exit(1);
}

logger.i('Worker started on file: ' + fileName);

var UPLOAD_PATH = _vc.config['upload'];
var PUBLIC_PATH = _vc.config['public'];
var TEMP_PATH = _vc.config['tmp'];

_vc.operationCanceled = false;

process.chdir(TEMP_PATH);

_vc.db = new DBVideo();

var id = null;
var VIDEO_ROOT = null;

_vc.db.connect(_vc.config['db'])
    .then(function() {
        return _vc.db.createNewVideo(fileName);
    })
    .then(function(_id) {
        id = _id;

        VIDEO_ROOT = Path.join(TEMP_PATH, id);
        var videosPath = Path.join(VIDEO_ROOT, 'videos');
        var imagesPath = Path.join(VIDEO_ROOT, 'images');

        var uploadFileName = 'upload' + Path.extname(fileName);

        fs.mkdirSync(VIDEO_ROOT);

        fs.mkdirSync(videosPath);
        fs.mkdirSync(imagesPath);

        fs.renameSync(
            Path.join(UPLOAD_PATH, fileName),
            Path.join(VIDEO_ROOT, uploadFileName)
        );

        return VideoUtils.processVideoFile(id, uploadFileName);
    })
    .then(function() {
        _vc.db.close();
    })
    .catch(function(error) {
        if (_vc.operationCanceled) {
            fs.rmdir(VIDEO_ROOT);

            logger.i(id, 'Operation canceled by db!');

        } else {
            logger.error(id, __filename, error);
        }

        _vc.db.close();
    });
