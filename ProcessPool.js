"use strict";

var                  fs = require('fs');
var                util = require('util');
var                path = require('path');
var                   _ = require('lodash');
var       child_process = require('child_process')
var        EventEmitter = require('events').EventEmitter;

var       DefaultWorker = __dirname + path.sep + "DefaultWorker.js";
var DefaultMaxProcesses = Math.ceil(require('os').cpus().length * 1.25);


fs.fileExistsSync = function(path) {
    return fs.existsSync(path) && fs.lstatSync(path).isFile();
}

function ProcessPool(options) {
    var self =this;
    _.assign(self, self.processOptions(options));

    EventEmitter.call(self);

    self.processes = [];
    self.jobs = [];
    self.lessons = [];
    self.counter = 0;

    process.nextTick(function() {
        self.maintainPool();
    });
}

util.inherits(ProcessPool, EventEmitter);

ProcessPool.prototype.any_eval = function(program, callback) {
    var self = this;

    if(typeof program === "function") {
        program = "(" + program.toString() + ")();"
    } else {
        program = program.toString();
    }

    self.jobs.push({
        data: {
            id: ++self.counter,
            command: 'eval',
            program: program
        },
        callback: callback
    });

    self.emit('debug', "A new 'any' job(" + self.counter + ") has been queued.");

    self.handleQueue();
};

ProcessPool.prototype.all_eval = function(program, callback) {
    var self = this;

    if(typeof program === "function") {
        program = "(" + program.toString() + ")();"
    } else {
        program = program.toString();
    }

    var job = {
        id: (++this.counter) + '.all.eval',
        command: 'eval',
        program: program
    };

    if(self.ENABLE_LEARNING) {
        self.lessons.push(job);
    }

    _.each(self.processes, function(_process) {
        self.jobs.push({
            process: _process.pid,
            data: job,
            callback: callback
        });
    });

    self.emit('debug', "A new 'all' job(" + self.counter + ") has been queued.");

    self.handleQueue();
};
ProcessPool.prototype.all_load = function(absolutePath, callback) {
    var self = this;

    if(!fs.fileExistsSync(absolutePath)) {
        throw "File '" + absolutePath + "' cannot be found."
    }

    var job = {
        id: (++self.counter) + '.all.load',
        command: 'load',
        path: absolutePath
    };

    if(self.ENABLE_LEARNING) {
        self.lessons.push(job);
    }

    _.each(self.processes, function(_process) {
        self.jobs.push({
            process: _process.pid,
            data: job,
            callback: callback
        });
    });

    self.emit('debug', "A new 'all' job(" + self.counter + ") has been queued.");

    self.handleQueue();
};

ProcessPool.prototype.totalProcesses = function() {
    return this.processes.length;
};

ProcessPool.prototype.pendingJobs = function() {
    return this.jobs.length;
}

ProcessPool.prototype.idleProcesses = function() {
    return _.filter(this.jobs, {_running:undefined}).length;
}

ProcessPool.prototype.destroy = function(rudely) {
    this._dying = true;
    
    if(rudely) {
        _.each(this.processes, function(process) {
            if(process._job) {
                process._job.callback("Process was forced to quit");
            }
            process.send({command:'kill', rude:true});
        });
    } else {
        this.killIdleProcesses();
    }
}

ProcessPool.prototype.killIdleProcesses = function() {
    _.each(this.processes, function(process) {
        if(!(process._job)) {
            process.send({command:'kill'});
        }
    });
}

ProcessPool.prototype.maintainPool = function() {
    if(!this._dying) {
        this.emit('debug', 'Maintaing Pool');
        var diff = 0;
        if(this.MAINTAIN_POOL_SIZE > 0) {
            diff = this.MAINTAIN_POOL_SIZE - this.totalProcesses();
        } else {
            diff = this.MAX_PROCESSES - this.totalProcesses();
        }

        if(diff > 0) {
            for(var i = this.MAINTAIN_POOL_SIZE - this.totalProcesses() ; i > 0 ; i--) {
                this.createNewProcess();
            }
        }
    }
}

ProcessPool.prototype.processOptions = function(options) {
    if(!options) {
        options = {};
    }

    var defaultOptions = this.getDefaultOptions();
    options = _.defaults(_.pick(options, _.keys(defaultOptions)), defaultOptions);

    if(!fs.fileExistsSync(options.MODULE)) {
        throw "Invalid value for options.MODULE";
    }

    if(typeof options.MAX_PROCESSES !== 'number' || options.MAX_PROCESSES < 1) {
        throw "Invalid value for options.MAX_PROCESSES";
    }

    if(typeof options.MAX_BACKLOG !== 'number') {
        throw "Invalid value for options.MAX_BACKLOG";
    }

    if(typeof options.MAX_REQUEST_TIME !== 'number') {
        throw "Invalid value for options.MAX_REQUEST_TIME";
    }

    if(typeof options.ENABLE_LEARNING !== 'number') {
        throw "Invalid value for options.ENABLE_LEARNING";
    }

    if(typeof options.MAINTAIN_POOL_SIZE !== 'number') {
        throw "Invalid value for options.MAINTAIN_POOL_SIZE";
    }

    options.MAINTAIN_POOL_SIZE = Math.min(options.MAINTAIN_POOL_SIZE, options.MAX_PROCESSES);

    return options;
}

ProcessPool.prototype.getDefaultOptions = function() {
    return {
        MODULE: DefaultWorker,                  // The default JS file to fork the child_process with
        MAX_PROCESSES: DefaultMaxProcesses,     // The max size of the pool at any time
                                                // Needs to be more than 0
        MAX_BACKLOG: DefaultMaxProcesses * 10,  // The maximum size of the backlog of pending jobs
                                                //TODO// Lacks Implementation
        MAX_REQUEST_TIME: -1,                   // The maximum time any job can run for before it is terminated
                                                //TODO// Lacks Implementation
        ENABLE_LEARNING: 1,                     // Scripts parsed through 'all_eval' and 'all_load' will persist
                                                // even into new processes that are created after those functions were called
        MAINTAIN_POOL_SIZE: 0                   // Minimum processes to maintain in the pool at any given time
                                                // -ve : Maintain pool size of MAX_PROCESSES
                                                // +ve : Maintain pool size of MAINTAIN_POOL_SIZE
                                                //   0 : Will not maintain pool size
    };
}

ProcessPool.prototype.createNewProcess = function() {
    if(this.totalProcesses() < this.MAX_PROCESSES) {
        var newProcess = child_process.fork(
            this.MODULE,
            this.getChildProcessArguments(),
            this.getChildProcessOptions()
        );
        newProcess.on('exit', this.handleProcessExit(newProcess.pid)); 
        this.allActiveProcesses().push(newProcess);       
        this.emit('debug', 'New process (' + newProcess.pid + ') has been created. (' + this.totalProcesses() + '/' + this.MAX_PROCESSES + ')');
        if(this.ENABLE_LEARNING) {
            this.teach(newProcess);
        }
        
    }
    return null;
}

ProcessPool.prototype.teach = function(newProcess) {
    var self = this;
    if(this.lessons.length > 0) {
        var tempListener = function(message) {
            if(message.error) {
                self.emit('debug', 'An error while teaching the new process "' + newProcess.pid + '" with data : ' + JSON.stringify(message));
            } else {
                newProcess.removeListener('message', tempListener);
                delete newProcess._job;
                this.emit('debug', 'Process (' + newProcess.pid + ') has been activated.');
                self.handleQueue();
            }
        };

        newProcess.on('message', tempListener);
        newProcess._job = {
            command: 'lessons',
            lessons: this.lessons
        };
        newProcess.send(newProcess._job);
    } else {
        self.emit('debug', "No lessons are available for this new process.");
        self.handleQueue();
    }
}

ProcessPool.prototype.handleProcessExit = function(processID) {
    var self = this;
    return function(code) {
        self.removeProcess(processID);

        self.jobs = _.difference(
            self.jobs,
            _(self.jobs)
                .filter({process:processID})
                .each(function(job) {
                    job.callback(code);
                    self.emit('error', "Process (" + processID + ")'s job failed as due to the exit. (" + job + ").");
                })
                .value()
        );

        if(self._dying) {
            self.emit('error', 'Process (' + processID + ') died with code : ' + code);
        } else {
            self.emit('debug', 'Process (' + processID + ') exited with code : ' + code)
            self.maintainPool();
        }
    };
}

ProcessPool.prototype.handleQueue = function() {
    if(this._dying) {
        this.killIdleProcesses();
    } else {
        this.emit('debug', 'Checking job queue.');
        while(_.find(this.jobs, {_running:undefined})) {
            var idleProcess = this.getIdleProcess();
            if(!idleProcess) {
                break;
            }

            this.assignWork(idleProcess);
        }
    }
}

ProcessPool.prototype.wrapCallback = function(callback) {
    return function() {
        if(callback) {
            var args = arguments;
            process.nextTick(function() {
                callback.apply(this, args);
            });
        }
    };
}

ProcessPool.prototype.assignWork = function(idleProcess) {
    var job = _.find(this.jobs, {process: idleProcess.pid, _running:undefined});
    if(!job) {
        job = _.find(this.jobs, {process: undefined, _running:undefined});
        this.emit('info', 'Job (' + job.data.id + ') has been assigned to process(' + idleProcess.pid + ')');
    }

    job.callback = this.wrapCallback(job.callback);

    var self = this;
    this.emit('debug', 'Starting job(' + job.data.id + ') on process (' + idleProcess.pid + ')');
    idleProcess.once('message', function(message) {
        if(message.error) {
            self.emit('error', 'An error occured during the job(' + job.data.id + ') on process (' + idleProcess.pid + ') with data : ' + JSON.stringify(message));
            self.emit('error', 'Error data : ' + message.error);
            job.callback(message.error);
        } else {
            self.emit('debug', 'Job(' + job.data.id + ') on process (' + idleProcess.pid + ') has completed successfully.');
            job.callback(null, message.result);
        }
        //TODO// remove it from the list of jobs
        self.jobs = _.difference(self.jobs, job);
        delete idleProcess._job;
        self.handleQueue();
    });
    idleProcess._job = job;
    idleProcess.send(job.data);
    job._running = true;
}

ProcessPool.prototype.removeProcess = function(processID) {
    this.processes = _.reject(this.processes, {pid:processID});
}

ProcessPool.prototype.getChildProcessArguments = function() {
    return undefined;
}

ProcessPool.prototype.getChildProcessOptions = function() {
    return undefined;
}

ProcessPool.prototype.getIdleProcess = function() {
    var idleProcess = _.find(this.allActiveProcesses(), function(_process) {
        return !_process._job;
    });
    if(idleProcess) {
        return idleProcess;
    }
    return this.createNewProcess();

}

ProcessPool.prototype.allActiveProcesses = function() {
    return this.processes;
}

module.exports = ProcessPool;