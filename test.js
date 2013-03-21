var ProcessPool = require('./ProcessPool');

var pool = new ProcessPool({
    MAINTAIN_POOL_SIZE: 10
});

//pool.on('error', function(arg) {console.error(arg)});
//pool.on('debug', function(arg) {console.log(arg)});

function createLongString(string, multiplier) {
    var result = string;
    for(var i = 0 ; i < multiplier ; i++) {
        result += string;
    }

    return result;
}

function getHash() {
    pool.any_eval(
        "bcrypt.hashSync('" + createLongString("bacon", 50) + "')",
        function(err, result) {
            console.log("Hash Result : " + JSON.stringify(arguments));
        }
    );
    setTimeout(getHash, 5000);
}


function teachModule() {
    pool.all_eval(
        "var bcrypt = require('bcrypt-nodejs');",
        function(err, result) {
            console.log("Finished loading bcrypt-nodejs");
        }
    );

    setTimeout(getHash, 5000);
}

setTimeout(teachModule, 10000);