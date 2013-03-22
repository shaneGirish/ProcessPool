'use strict';

var                  fs = require('fs');
var                util = require('util');
var                path = require('path');
var                   _ = require('lodash');
var        EventEmitter = require('events').EventEmitter;

function ProcessPool() {
    EventEmitter.call(this);

    _.assign(this, this.processOptions(options));

    var self = this;
    process.nexTick(function() {
        self.maintainPool();
    });
}

util.inherits(ProcessPool, EventEmitter);

ProcessPool.prototype.teach = function(options) {
    
}

ProcessPool.prototype.execute = function(options) {

}

ProcessPool.prototype.refresh = function(options) {

}

ProcessPool.prototype.maintainPool = function(options) {
    this.
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

ProcessPool.getDefaultMaxPoolSize = function() {
    return Math.ceil(require('os').cpus().length * 1.25);
}

ProcessPool.getDefaultOptions = function() {
    return {
        MIN_SIZE    : 0,
        MAX_SIZE    : ProcessPool.getDefaultMaxPoolSize(),
        MAX_BACKLOG : ProcessPool.getDefaultMaxPoolSize() * 10,
        LEARNING    : true
    };
}