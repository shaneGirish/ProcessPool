var _ = require('lodash');

function WrapCallback() {
    var callback = pick.apply(this, arguments);
    if(!callback) {
        return WrapCallback.EmptyFunction;
    }

    if(callback.__wrappedCallback) {
        return callback;
    }

    var wrapped = function() {
        var args = arguments;
        process.nextTick(function() {
            callback.apply(this, args);
        });
    }
    wrapped.__wrappedCallback = true;
    return wrapped;
}

WrapCallback.EmptyFunction = function() {};
WrapCallback.EmptyFunction.__wrapped = true;

module.exports = WrapCallback;

function pick() {
    return _(arguments)
        .values()
        .compact()
        .flatten()
        .find(function(value) {
            if(value.__wrappedCallback || typeof value === 'function') {
                return true;
            }
        });
}