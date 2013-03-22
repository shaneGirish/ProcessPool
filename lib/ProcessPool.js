'use strict';

var            fs = require('fs');
var          util = require('util');
var          path = require('path');
var             _ = require('lodash');
var  EventEmitter = require('events').EventEmitter;

var          Task = require(__dirname + '/Task');
var        Worker = require(__dirname + '/Worker');
var  WrapCallback = require(__dirname + '/WrapCallback');

function ProcessPool(options) {
    EventEmitter.call(this);

    _.assign(this, this.processOptions(options));

    this._workers = [];
    this._tasks = [];
    this._lessons = [];

    this.maintainPool();

    this.on('IdleWorker', this.processTaskQueue);
}

util.inherits(ProcessPool, EventEmitter);

ProcessPool.prototype.teach = function(task, callback, errorCallback, persistErrorCallBack) {
    task = this.getEvalScript(task);
    
    var lesson = Task.new('eval', task);
    lesson.callback = WrapCallback(callback);
    lesson.errorCallback = WrapCallback(errorCallback, lesson.callback);

    var self = this;

    _.each(this.workers(), function(worker) {
        var task = lesson.clone();
        task.worker = worker;

        self.tasks().push(task);
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
    var _task = Task.new('eval', this.getEvalScript(task));
    _task.callback = callback;

    this.tasks().push(_task);

    this.emit('debug', task.toString() + " has been queued.");

    this.processTaskQueue();
}

ProcessPool.prototype.refresh = function(newMaxPoolSize) {

}

ProcessPool.prototype.maintainPool = function(sync) {
    var self = this;
    if(!sync) {
        process.nextTick(function() {
            self.maintainPool(true);
        });
    }

    if(this.MIN_POOL_SIZE != 0) {
        this.emit('debug', 'Creating workers.');
        for(var i = this.MIN_POOL_SIZE - this.size() ; i > 0 ; i--) {
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

ProcessPool.prototype.lessons = function() {
    return this._lessons;
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

ProcessPool.prototype.getEvalScript = function(program) {
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

ProcessPool.prototype.setMinPoolSize = function(value) {
    if(value) {
        this.MIN_POOL_SIZE = Math.min(value, this.MAX_POOL_SIZE);
        if(this.MIN_POOL_SIZE < 0) {
            this.MIN_POOL_SIZE = this.MAX_POOL_SIZE;
            this.emit('debug', 'Minimum Pool Size has been set to ' + this.MIN_POOL_SIZE + ".");
        }
    }
}

ProcessPool.prototype.createNewWorker = function() {
    if(this.isDying()) {
        this.emit('warning', 'Pool is dying. Cannot create new worker.');
        return;
    }

    if(this.size() < this.MAX_POOL_SIZE) {
        var worker = new Worker(this.MODULE);
        worker.setEventEmitter(this);
        worker.getProcess().on('exit', this.newWorkerExitHandler(worker));
        this.workers().push(worker);
        this.emit('debug', worker + ' has been created. (' + this.size() + '/' + this.MAX_POOL_SIZE + ')');
        if(this.LEARNING) {
            worker.teach(this.lessons());
        }
    }
}

ProcessPool.prototype.newWorkerExitHandler = function(worker) {
    var self = this;
    return function(code) {
        self.removeWorker(worker);
        self.emit('error', worker.toString() + (self.isDying()?" died":" failed") + " with exit code : " + code);

        if(!self.isDying()) {
            self.maintainPool();
        }
    };
}

ProcessPool.prototype.removeWorker = function(worker) {
    try {
        worker.kill();
        //TODO// Try to kill it using worker._process.
    } catch(e) {}

    try {
        worker._task.callback(worker.toString() + " failed as it quit" + this.isDying()?".":" unexpectedly.");
    } catch(e) {}

    try {
        delete worker._task.callback;
        delete worker._task.errorCallback;
        worker._task = {};
    } catch(e) {}
}

ProcessPool.prototype.processTaskQueue = function() {
    if(this.isDying()) {
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
            self.removeTask(task);
            delete task.worker;
            worker.execute(task);
        }
    });
}

ProcessPool.prototype.removeTask = function(task) {
    this._tasks = _.difference(this._tasks, task);
}

ProcessPool.prototype.processOptions = function(options) {
    if(!options) {
        options = {};
    }

    var defaultOptions = ProcessPool.getDefaultOptions();
    options = _.defaults(_.pick(options, _.keys(defaultOptions)), defaultOptions);

    if(!(fs.existsSync(options.MODULE) && fs.lstatSync(options.MODULE).isFile())) {
        throw "File '" + options.MODULE + "' doesn't exist.";
    }

    if(typeof options.MIN_POOL_SIZE !== 'number') {
        throw "'" + options.MIN_POOL_SIZE + "' is not a valid value for MIN_POOL_SIZE";
    }

    if(typeof options.MAX_POOL_SIZE !== 'number' || options.MAX_POOL_SIZE < 1) {
        throw "'" + options.MAX_POOL_SIZE + "' is not a valid value for MAX_POOL_SIZE";
    }

    if(typeof options.MAX_BACKLOG !== 'number') {
        throw "'" + options.MAX_BACKLOG + "' is not a valid value for MAX_BACKLOG";
    }

    if(typeof options.LEARNING !== 'boolean') {
        throw "'" + options.LEARNING + "' is not a valid value for LEARNING";
    }

    options.MIN_POOL_SIZE = Math.min(options.MIN_POOL_SIZE, options.MAX_POOL_SIZE);
    if(options.MIN_POOL_SIZE < 0) {
        options.MIN_POOL_SIZE = options.MAX_POOL_SIZE;
    }

    return options;
}

///////////////////////////////////////////////////////

ProcessPool.DefaultMaxPoolSize = Math.ceil(require('os').cpus().length * 1.25);

ProcessPool.getDefaultOptions = function() {
    return {
        MODULE          : Worker.getDefaultModule(),
        MIN_POOL_SIZE   : 0,
        MAX_POOL_SIZE   : ProcessPool.DefaultMaxPoolSize,
        MAX_BACKLOG     : ProcessPool.DefaultMaxPoolSize * 10,
        LEARNING        : true
    };
}

module.exports = ProcessPool;