/**
 * Created by wangsheng on 1/7/16.
 */

class AST_Token {

    type: string;
    value: string;
    tokPos: number;
    tokLine: number;

    constructor(type: string, value: string, tokPos: number, tokLine: number) {
        this.type = type;
        this.value = value;
        this.tokPos = tokPos;
        this.tokLine = tokLine;
    }
}