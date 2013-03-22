'use strict';

var child_process = require('child_process');
var  EventEmitter = require('events').EventEmitter;

function Worker(modulePath, args, options) {
    this._process = child_process.fork(
        modulePath,
        args,
        options
    );

    this.ID = this._process.pid;
}

Worker.prototype.isBusy = function() {
    return this._task;
}

Worker.prototype.teach = function(lessons, callback) {

}

Worker.prototype.execute = function(task, callback) {
    this._task = task;
    callback = this.wrapCallback(callback);
}

function wrapCallback = function(callback) {
    return function() {
        if(callback) {
            var args = arguments;
            process.nextTick(function() {
                callback.apply(this, args);
            });
        }
    };
}

Worker.getDefaultModule = function() {
    return __dirname + path.sep + "DefaultWorker.js";
}
Worker.getDefaultArguments = function() {
    return undefined;
}
Worker.getDefaultOptions = function() {
    return undefined;
}

Worker.new = function() {
    return (new Worker(
        Worker.getDefaultModule(),
        Worker.getDefaultArguments(),
        Worker.getDefaultOptions()
    ));
}