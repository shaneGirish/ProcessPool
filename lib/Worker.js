'use strict';

var           util = require('util');
var           path = require('path');
var              _ = require('lodash');
var  child_process = require('child_process');
var   EventEmitter = require('events').EventEmitter;
var   WrapCallback = require(__dirname + '/WrapCallback');

function Worker(modulePath, args, options) {
    modulePath = modulePath || Worker.getDefaultModule();
    args = args || Worker.getDefaultArguments();
    options = options || Worker.getDefaultOptions();

    EventEmitter.call(this);

    this._process = child_process.fork(
        modulePath,
        args,
        options
    );

    this.ID = this._process.pid;

    this._eventEmitter = this;
};

util.inherits(Worker, EventEmitter);

Worker.prototype.isBusy = function() {
    return this._task;
};

Worker.prototype.teach = function(lessons, callback, errorCallback) {
    callback = WrapCallback(callback);

    if(errorCallback && typeof errorCallback === 'function') {
        errorCallback = WrapCallback(errorCallback);
    } else {
        errorCallback = callback;
    }

    this._eventEmitter.emit('debug', 'Started teaching ' + this + '.');

    this._task = lessons;

    var self = this;
    self._tempListener = function(message) {
        if(!message.result) {
            self._eventEmitter.emit('extended-error', message);
            self._eventEmitter.emit('error', 'Lesson[' + message.lesson + '] encountered an error while running on ' + self.toString());
            errorCallback(message.error);
            WrapCallback(_.find(self._task, {id:message.lesson.id}).errorCallback)(message.error);
        } else {
            self.emit('debug', 'Lessons were taught on ' + self.toString());
            self._process.removeListener('message', self._tempListener);
            delete self._task;
            delete self._tempListener;

            callback(null, message.result);

            self._eventEmitter.emit('IdleWorker');
        }
    };
    this._process.on('message', self._tempListener);
    this._process.send({
        command: 'learn',
        payload: lessons
    });
};

Worker.prototype.execute = function(task, callback) {
    this._task = task;
    task._worker = this;
    var callback = WrapCallback(callback, task.callback);

    var self = this;
    this._process.once('message', function(message) {
        if(message.error) {
            self._eventEmitter.emit('extended-error', message);
            self._eventEmitter.emit('error', task.toString() + ' encountered an error while running on ' + self.toString());
            callback(message.error);
        } else {
            self._eventEmitter.emit('debug', task.toString() + ' was successfully run on ' + self.toString());
            callback(null, message.result);
        }
        delete self._task;
        delete task._worker;

        self._eventEmitter.emit('IdleWorker');
    });
    this._process.send(_.pick(task, 'id', 'command', 'payload'));
};

Worker.prototype.kill = function() {
    this._process.send({command:'die'});
};

Worker.prototype.setEventEmitter = function(eventEmitter) {
    this._eventEmitter = eventEmitter;
};

Worker.prototype.getProcess = function() {
    return this._process;
};

Worker.prototype.toString = function() {
    return 'Worker[' + this.ID + ']';
};

Worker.getDefaultModule = function() {
    return __dirname + path.sep + "DefaultWorkerModule.js";
};

Worker.getDefaultArguments = function() {
    return undefined;
};

Worker.getDefaultOptions = function() {
    return undefined;
};

module.exports = Worker;