/**
 * Created by wangsheng on 30/6/16.
 */

interface Predicate {
    (candidate: string) : boolean;
}

// this function is taken from Acorn [1], written by Marijn Haverbeke
// [1] https://github.com/marijnh/acorn
function makePredicate(words: string | string[]): Predicate{
    if (!(words instanceof Array)) words = (<string>words).split(" ");
    var f = "", cats = [];
    out: for (var i = 0; i < words.length; ++i) {
        for (var j = 0; j < cats.length; ++j)
            if (cats[j][0].length == words[i].length) {
                cats[j].push(words[i]);
                continue out;
            }
        cats.push([words[i]]);
    }
    function compareTo(arr) {
        if (arr.length == 1) return f += "return str === " + JSON.stringify(arr[0]) + ";";
        f += "switch(str){";
        for (var i = 0; i < arr.length; ++i) f += "case " + JSON.stringify(arr[i]) + ":";
        f += "return true}return false;";
    }
    // When there are more than three length categories, an outer
    // switch first dispatches on the lengths, to save on comparisons.
    if (cats.length > 3) {
        cats.sort(function(a, b) {return b.length - a.length;});
        f += "switch(str.length){";
        for (var i = 0; i < cats.length; ++i) {
            var cat = cats[i];
            f += "case " + cat[0].length + ":";
            compareTo(cat);
        }
        f += "}";
        // Otherwise, simply generate a flat `switch` statement.
    } else {
        compareTo(words);
    }
    return <Predicate>(new Function("str", f));
}

class Map<T> extends null {

    public set(key: string, t: T) {
        this[key] = t;
    }

    public get(key: string): T {
        return this[key];
    }

}

function JS_Parse_Error(message:string, line:number, pos:number) {
    this.message = message;
    this.line = line;
    this.pos = pos;
}

JS_Parse_Error.prototype.toString = function () {
    return this.message + " (line: " + this.line + ", pos: " + this.pos + ")" + "\n\n" + this.message;
};

function js_error(message, line, pos) {
    throw new JS_Parse_Error(message, line, pos);
}