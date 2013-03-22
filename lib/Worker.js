'use strict';

var   child_process = require('child_process');
var    EventEmitter = require('events').EventEmitter;
var WrappedCallback = require(__dirname + '/WrappedCallback');

function Worker(modulePath, args, options) {
    EventEmitter.call(this);

    this._process = child_process.fork(
        modulePath,
        args,
        options
    );

    this.ID = this._process.pid;

    util.inherits(ProcessPool, EventEmitter);
};

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

    this._task = lessons;

    var self = this;
    self._tempListener = function(message) {
        if(message.error) {
            self.emit('extended-error', message);
            self.emit('error', 'Lesson[' + message.lesson + '] encountered an error while running on ' + self.toString());
            errorCallback(message.error);
            WrapCallback(_.find(self._task, {id:message.lesson.id}).errorCallback)(message.error);
        } else {
            self.emit('debug', 'Lessons were taught on ' + self.toString());
            self.removeListener('message', self._tempListener);
            delete self._task;
            delete self._tempListener;

            callback(null, message.result);

            self.emit('IdleWorker');
        }
    };
    this._process.on('message', self._tempListener);
    this._process.send(task);
};

Worker.prototype.execute = function(task, callback) {
    this._task = task;
    task._worker = this;
    var callback = WrapCallback(callback, task.callback);

    var self = this;
    this._process.once('message', function(message) {
        if(message.error) {
            self.emit('extended-error', message);
            self.emit('error', task.toString() + ' encountered an error while running on ' + self.toString());
            callback(message.error);
        } else {
            self.emit('debug', task.toString() + ' was successfully run on ' + self.toString());
            callback(null, message.result);
        }
        delete self._task;
        delete task._worker;

        self.emit('IdleWorker');
    });
    this._process.send(task);
};

Worker.prototype._emit = Worker.prototype.emit;

Worker.prototype.emit = fucnction() {
    if(this._eventEmitter) {
        this._eventEmitter.emit.apply(this, arguments);
    } else {
        this._emit.apply(this, arguments);
    }
};

Worker.prototype.setEventEmitter = function(eventEmitter) {
    this._eventEmitter = eventEmitter;
};

Worker.prototype.getProcess = function() {
    return _process;
};

Worker.prototype.toString = function() {
    return 'Worker[' + this.ID + ']';
};

Worker.getDefaultModule = function() {
    return __dirname + path.sep + "DefaultWorker.js";
};

Worker.getDefaultArguments = function() {
    return undefined;
};

Worker.getDefaultOptions = function() {
    return undefined;
};

Worker.new = function() {
    return (new Worker(
        Worker.getDefaultModule(),
        Worker.getDefaultArguments(),
        Worker.getDefaultOptions()
    ));
};