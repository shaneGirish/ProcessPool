'use strict';

var       _ = require('lodash');

var    root = global;
root.require = require;

function __eval(script) {
    return (eval.bind(root))(script);
}

process.on('message', function(task) {
    if(task.command === 'eval') {
        var result = null, error = null;
        try {
            result = __eval(task.payload);
        } catch(err) {
            error = JSON.stringify(err);
        }

        process.send({
            task: task,
            result: result,
            error: error,
            section: 'eval'
        });
    } else if(task.command === 'learn') {
        _.each(task.payload, function(lesson) {
            try {
                __eval(lesson.payload);
            } catch(err) {
                process.send({
                    lesson: lesson.payload,
                    error: JSON.stringify(err),
                    section: 'learn-Error'
                });
            }
        });

        process.send({
            task: task,
            result: 'done',
            section: 'learn-final'
        });
    } else if(task.command === 'die') {
        process.exit();
    }
});