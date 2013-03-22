var _ = require('lodash');

function WrappedCallback() {
    var callback = pick.apply(this, arguments);
    if(callback.__wrappedCallback) {
        return callback;
    }

    var wrapped;
    if(callback && typeof callback === 'function') {
        wrapped = function() {
            var args = arguments;
            process.nextTick(function() {
                callback.apply(this, args);
            });
        }
    } else {
        wrapped = function() {};
    }

    wrapped.__wrappedCallback = true;
    return wrapped;
}

module.exports = WrappedCallback;

function pick() {
    return _(arguments)
        .values()
        .flatten()
        .find(function(value, index) {
            if(value.__wrappedCallback || typeof callback === 'function') {
                return true;
            }
        })
        .value();
}