var ProcessPool = require(__dirname + '/ProcessPool');

var pool = new ProcessPool({
    MIN_POOL_SIZE: 10
});

pool.on('extended-error', function(arg) {
    console.error("E-Error");
    console.error(arg);
    console.error();
});
pool.on('error', function(arg) {
    console.error("Error");
    console.error(arg);
    console.error();
});
pool.on('debug', function(arg) {
    console.log("Debug :" + arg);
    console.log();
});
pool.on('warning', function(arg) {
    console.warn("Warning : " + arg);
    console.warn();
});

function createLongString(string, multiplier) {
    var result = string;
    for(var i = 0 ; i < multiplier ; i++) {
        result += string;
    }

    return result;
}

function getHash() {
    pool.execute(
        "bcrypt.hashSync('" + createLongString("bacon", 50) + "')",
        function(err, result) {
            console.log("Hash Result : " + JSON.stringify(arguments));
        }
    );
    setTimeout(getHash, 5000);
}


function teachModule() {
    pool.teach(
        "var bcrypt = require('bcrypt-nodejs');",
        function(err, result) {
            console.log("Finished loading bcrypt-nodejs");
        }
    );

    setTimeout(getHash, 5000);
}

setTimeout(teachModule, 1000);