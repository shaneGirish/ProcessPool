'use strict';

var                  fs = require('fs');
var                util = require('util');
var                path = require('path');
var                   _ = require('lodash');
var        EventEmitter = require('events').EventEmitter;

function ProcessPool() {
    EventEmitter.call(this);

    _.assign(this, this.processOptions(options));

    this._workers = [];
    this._tasks = [];
    this._lessons = [];

    var self = this;
    process.nexTick(function() {
        self.maintainPool();
    });

    this.on('IdleWorker', this.processTaskQueue);
}

util.inherits(ProcessPool, EventEmitter);

ProcessPool.prototype.teach = function(task, callback, errorCallback, persistErrorCallBack) {
    task = this.getEvalScript(task);
    
    var lesson = new Task('eval', task);
    lesson.callback = WrappedCallback(callback);
    lesson.errorCallback = WrappedCallback(errorCallback, lesson.callback);

    _.each(this.workers(), function(worker) {
        this.tasks().push(_(lesson).clone().extend({worker:worker}).value());
    });

    if(this.LEARNING) {
        delete lesson.callback;
        if(!persistErrorCallBack) {
            delete lesson.errorCallback;
        }
        this._lessons.push(lesson);
    }

    this.processTaskQueue();
}

ProcessPool.prototype.execute = function(task, callback) {
    this.tasks().push(
        _(new Task('eval', this.getEvalScript(task)))
            .extend({
                callback: WrappedCallback(callback)
            })
            .value()
    );

    this.processTaskQueue();
}

ProcessPool.prototype.refresh = function(newMaxPoolSize) {

}

ProcessPool.prototype.maintainPool = function(newMinPoolSize) {
    if(this.isDying()) {
        this.emit('warning', 'Pool is dying. Cannot maintain pool.');
        return;
    }

    this.setMinPoolSize(newMinPoolSize);

    if(this.MIN_POOL_SIZE != 0) {
        for(var i = this.MAINTAIN_POOL_SIZE - this.totalProcesses() ; i > 0 ; i--) {
            this.createNewWorker();
        }
    }
}

ProcessPool.prototype.workers = function() {
    return this._workers;
}

ProcessPool.prototype.tasks = function() {
    return this._tasks;
}

ProcessPool.prototype.size = function() {
    return this.workers().length;
}

ProcessPool.prototype.idleWorkers = function() {
    return _.filter(this.workers(), function(worker) {
        return !worker.isBusy();
    });
}

ProcessPool.prototype.pendingTasks = function() {
    return this.tasks();
}

ProcessPool.prototype.destroy = function(rudely) {
    this._beingDestroyed = true;
    _.each(this.workers, function(worker) {
        worker.kill(rudely);
    });
}

///////////////////////////////////////////////////////

ProcessPool.protoype.getEvalScript = function(program) {
    if(typeof program === "function") {
        program = "(" + program.toString() + ")();"
    } else {
        program = program.toString();
    }
    return program;
}

ProcessPool.prototype.isDying = function() {
    return this._beingDestroyed;
}

Process.prototype.setMinPoolSize = function(value) {
    if(value) {
        this.MIN_POOL_SIZE = Math.min(value, this.MAX_POOL_SIZE);
        if(this.MIN_POOL_SIZE < 0) {
            this.MIN_POOL_SIZE = this.MAX_POOL_SIZE;
        }
    }
}

Process.prototype.createNewWorker = function() {
    if(isDying()) {
        this.emit('warning', 'Pool is dying. Cannot create new worker.');
        return;
    }

    if(this.size() < this.MAX_POOL_SIZE) {
        var worker = Worker.new();
        worker.setEventEmitter(this);
        worker.getProcess().on('exit', this.newWorkerExitHandler(worker));
        this.workers().push(worker);
        this.emit('debug', worker + ' has been created. (' + this.size() + '/' + this.MAX_POOL_SIZE + ')');
        if(this.LEARNING) {
            worker.teach(this.lessons());
        }
    }
}

Process.prototype.processTaskQueue = function() {
    if(isDying()) {
        this.killIdleWorkers();
        return;
    }

    this.emit('debug', 'Checking job queue.');

    var self = this;
    _.each(this.idleWorkers(), function(worker) {
        var task = _.find(self.tasks(), {worker:worker});
        if(!task) {
            task  = _.find(self.tasks(), {worker:undefined});
        }
        if(task) {
            self.tasks() = _.difference(self.tasks(), task);
            worker.execute(task);
        }
    });
}

///////////////////////////////////////////////////////

ProcessPool.DefaultMaxPoolSize = Math.ceil(require('os').cpus().length * 1.25);

ProcessPool.getDefaultOptions = function() {
    return {
        MIN_POOL_SIZE   : 0,
        MAX_POOL_SIZE   : ProcessPool.DefaultMaxPoolSize,
        MAX_BACKLOG     : ProcessPool.DefaultMaxPoolSize * 10,
        LEARNING        : true
    };
}