"use strict";
var crypto_1 = require('crypto');
var ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function freshId(length) {
    if (length === void 0) { length = 15; }
    if (length < 1) {
        throw new Error('Ids must be at least one character long');
    }
    var id = '';
    var random = crypto_1.randomBytes(length);
    var cursor = 0;
    for (var i = 0; i < length; i += 1) {
        cursor += random[i];
        id += ALPHANUM[cursor % ALPHANUM.length];
    }
    return id;
}
exports.freshId = freshId;
