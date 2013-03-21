var ProcessPool = require('./ProcessPool');

var pool = new ProcessPool();

pool.on('error', function(arg) {console.err(arg)});
pool.on('debug', function(arg) {console.log(arg)});

function createLongString(string, multiplier) {
    var result = string;
    for(var i = 0 ; i < multiplier ; i++) {
        result += string;
    }

    return result;
}

pool.all_eval(
    "var bcrypt = require('bcrypt-nodejs');",
    function(err, result) {
        console.log("callback : " + JSON.stringify(arguments))
    }
);

pool.any_eval(
    "bcrypt.hashSync('" + createLongString("bacon", 50) + "')",
    function(err, result) {
        console.log("callback : " + JSON.stringify(arguments))
    }
);