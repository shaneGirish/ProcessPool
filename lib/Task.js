'use strict';

var util = require('util');

function Task(command, payload) {
    this.id = ++Task.Counter;
    this.command = command;
    this.payload = payload;
}

Task.prototype.toString = function() {
    return 'Task[' + this.id + '][' + this.command + '(' + this.payload + ')]';
}

Task.Counter = 0;