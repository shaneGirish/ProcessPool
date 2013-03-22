var ProcessPool = require(__dirname + '/ProcessPool');

var pool = new ProcessPool({
    MIN_POOL_SIZE: 10
});

var PRINT = true;

pool.on('extended-error', function(arg) {
    if(PRINT) {
        console.error("E-Error");
        console.error(arg);
        console.error();
    }    
});
pool.on('error', function(arg) {
    if(PRINT) {
        console.error("Error");
        console.error(arg);
        console.error();
    }
});
pool.on('debug', function(arg) {
    if(PRINT) {
        console.log("Debug: " + arg);
    }    
});
pool.on('warning', function(arg) {
    if(PRINT) {
        console.warn("Warning: " + arg);
    }    
});

function createLongString(string, multiplier) {
    var result = string;
    for(var i = 0 ; i < multiplier ; i++) {
        result += string;
    }

    return result;
}

function getHash() {
    console.log("Pending Jobs : " + pool.pendingTasks().length);
    console.log("Workers : " + pool.idleWorkers().length + "/" + pool.size());

    pool.execute(
        "bcrypt.hashSync('" + createLongString("bacon", 0) + "')",
        function(err, result) {
            console.log("Hash Result : " + JSON.stringify(arguments));
        }
    );
    setTimeout(getHash, 100);
}

function changePool() {
    pool.MAX_POOL_SIZE = 20;
    pool.MIN_POOL_SIZE = 10;
    pool.maintainPool();

    setTimeout(getHash, 5000);
}

function teachModule() {
    console.log("ProcessPool : ");
    console.log("    MODULE        : " + pool.MODULE);
    console.log("    MIN_POOL_SIZE : " + pool.MIN_POOL_SIZE);
    console.log("    MAX_POOL_SIZE : " + pool.MAX_POOL_SIZE);
    console.log("    MAX_BACKLOG   : " + pool.MAX_BACKLOG);
    console.log("    LEARNING      : " + pool.LEARNING);

    pool.teach(
        "var bcrypt = require('bcrypt-nodejs');",
        function(err, result) {
            console.log("Finished loading bcrypt-nodejs");
        }
    );

    setTimeout(changePool, 500);
}

setTimeout(teachModule, 1000);
