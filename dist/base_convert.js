'use strict';

var NUMERALS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$_';

/**
 * convert arbitary long integer from one base to another
 * Taken from decimal.js
*/
function baseConvert(str) {
    var baseIn = arguments.length <= 1 || arguments[1] === undefined ? 10 : arguments[1];
    var baseOut = arguments.length <= 2 || arguments[2] === undefined ? 62 : arguments[2];

    var str = String(str);
    var j,
        arr = [0],
        arrL,
        i = 0,
        strL = str.length;

    for (; i < strL;) {
        for (arrL = arr.length; arrL--; arr[arrL] *= baseIn) {}
        arr[j = 0] += NUMERALS.indexOf(str.charAt(i++));

        for (; j < arr.length; j++) {

            if (arr[j] > baseOut - 1) {

                if (arr[j + 1] == null) {
                    arr[j + 1] = 0;
                }
                arr[j + 1] += arr[j] / baseOut | 0;
                arr[j] %= baseOut;
            }
        }
    }

    var result = arr.reverse().map(function (i) {
        return NUMERALS[i];
    }).join('');
    if (baseOut <= 36 && baseOut > 10) {
        return result.toLowerCase();
    }
    return result;
}

module.exports = baseConvert;