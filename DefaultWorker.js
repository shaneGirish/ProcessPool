//"use strict";

var      fs = require('fs');
var       _ = require('lodash');
var    root = global;

root.require = require;

process.on('message', handleMessage);

function handleMessage(message, DONT_SEND) {
    try {
        if(message.command === 'eval') {
            var result = (eval.bind(root))(message.program);
            if(!DONT_SEND) {
                process.send({
                    process: process.env.NODE_UNIQUE_ID,
                    success: true,
                    result: result
                });
            }            
        } else if(message.command === 'load'){
            eval.bind(root)(fs.readFileSync(message.path, "UTF8"));
            if(!DONT_SEND) {
                process.send({
                    process: process.env.NODE_UNIQUE_ID,
                    success: true
                });
            }            
        } else if(message.command === 'kill'){
            process.exit();
        } else if(message.command === 'lessons') {
            _.each(message.lessons, function(lesson) {
                handleMessage(lesson, true);
            });

            process.send({
                process: process.env.NODE_UNIQUE_ID,
                success: true,
                finished_learning: true
            });
        }
    } catch(err) {
        process.send({
            process: process.env.NODE_UNIQUE_ID,
            data: message,
            error: err
        });
    }
}