'use strict';

function Task() {}

Task.new = function(command, payload) {
    var task = new Task();
    task.id = ++Task.Counter;
    task.command = command;
    task.payload = payload;

    return task;
}

Task.prototype.clone = function() {
    var newTask = new Task();
    newTask.id = this.id;
    newTask.command = this.command;
    newTask.payload = this.payload;

    return newTask;
}

Task.prototype.toString = function() {
    return 'Task[' + this.id + '][' + this.command + '(' + this.payload + ')]';
}

Task.Counter = 0;

module.exports = Task;