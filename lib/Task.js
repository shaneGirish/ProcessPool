'use strict';

var util = require('util');

function Task(command, payload) {
    this.command = command;
    this.payload = payload;
}

Task.prototype.execute = function(worker) {
    this._worker = worker;
    worker.execute(task);
}