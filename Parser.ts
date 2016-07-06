/**
 * Created by wangsheng on 2/7/16.
 */

///<reference path="Tokenizer.ts"/>

function Parser(input:() => AST_Token) {

    interface parser_status {
        input:() => AST_Token;
        token:AST_Token;
        prev:AST_Token;
        peeked:AST_Token;
    }

    var S:parser_status = {
        input: input,
        token: null,
        prev: null,
        peeked: null
    };

    S.token = next();

    function is(type:TokenType, val?:string):boolean {
        return S.token.type == type && (val == undefined || S.token.value == val);
    }

    function isOfAnyType(types:TokenType[]) {
        return types.indexOf(S.token.type) == -1 ? false : true;
    }

    function peek():AST_Token {
        return S.peeked || (S.peeked = S.input());
    }

    function next():AST_Token {
        S.prev = S.token;
        if (S.peeked) {
            S.token = S.peeked;
            S.peeked = null;
        } else {
            S.token = S.input();
        }
        return S.token;
    }

    function prev():AST_Token {
        return S.prev;
    }

    function match_token(type: TokenType, val?: string): AST_Token {
        if (is(type, val)) {
            let ret = S.token;
            next();
            return ret;
        }
        js_error("SyntaxError: not expecting " + S.token.value, S.token.tokLine, S.token.tokPos);
    }

    function parse_error(message: string) {
        js_error(message, S.token.tokLine, S.token.tokPos);
    }

    function unexpected(token?: AST_Token) {
        if (token == null)
            token = S.token;
        js_error("unexpected token: " + token.value, token.tokLine, token.tokPos);
    }

    //parse will continue calling this method until reaching eof
    function parse() {
        while(S.token.type !== TokenType.EOF) {
            switch (S.token.type) {
                case TokenType.QAS:
                    console.log(question());
                    break;
                case TokenType.ALBS:
                    match_token(TokenType.ALBS);
                    while(!is(TokenType.ALBE)) {
                        console.log(statement());
                    }
                    match_token(TokenType.ALBE);
                    break;
            }
        }
    }

    function maybe_propAccess(container: AST_Node){
        if(is(TokenType.Punc, ".") && (container instanceof AST_Dot|| container instanceof AST_SymbolRef)) {
            var r = next();
            if(is(TokenType.Identifier)) {
                var prop = new AST_SymbolRef(r);
                next();
                return maybe_propAccess(new AST_Dot(container, prop));
            } else {
                parse_error("SyntaxError: invalid property name");
            }

        }
        return container;
    }

    function symbol_ref() {
        var ret = new AST_SymbolRef(S.token);
        next();
        return ret;
    }

    function _num(){
        var ret = new AST_Num(S.token);
        next();
        return ret;
    }

    function _string(){
        var ret = new AST_String(S.token);
        next();
        return ret;
    }

    function _false(){
        var ret = new AST_False(S.token);
        next();
        return ret;
    }

    function _true(){
        var ret = new AST_True(S.token);
        next();
        return ret;
    }

    function _undefined(){
        var ret = new AST_Undefined(S.token);
        next();
        return ret;
    }

    function _args_list(){
        let args: AST_Node[] = [];
        match_token(TokenType.Punc, "(");
        args.push(expression());
        while(!is(TokenType.Punc, ")")){
            match_token(TokenType.Punc, ",");
            args.push(expression());
        }
        match_token(TokenType.Punc, ")");
        return args;
    }

    function _answer_has(){
        let start = S.token;
        match_token(TokenType.KW_AL, "answer");
        match_token(TokenType.KW_AL, "for");
        let question = new AST_SymbolRef(match_token(TokenType.Identifier));
        switch(S.token.value){
            case "has":
            case "has_not":
            case "only_has":
                next();
                return new AST_HasAnswer(start, question, _args_list(), prev());
            default:
                unexpected();
        }
    }
    
    function expr_atom(): AST_Node{
        var tok = S.token;
        switch (tok.type) {
            case TokenType.Punc:
                if(is(TokenType.Punc, "(")) {
                    let start = tok; //start token is (
                    next();
                    var ex = expression();
                    ex.start = start;
                    ex.end = S.token; //end token is )
                    match_token(TokenType.Punc, ")");
                    return maybe_propAccess(ex);
                }
                break;
            case TokenType.Identifier:
                return maybe_propAccess(symbol_ref());
            case TokenType.Num:
                return _num();
            case TokenType.String:
                return _string();
            case TokenType.KW_Val_AL:
                switch (tok.value) {
                    case "false":
                        return _false();
                    case "true":
                        return _true();
                    case "undefined":
                        return _undefined();
                }
                break;
            case TokenType.KW_AL:
                if(tok.value === "answer") {
                    return _answer_has();
                }
                break;
        }
        unexpected();
    }

    var PRECEDENCE = (function(a, ret){
        for (var i = 0; i < a.length; ++i) {
            var b = a[i];
            for (var j = 0; j < b.length; ++j) {
                ret[b[j]] = i + 1;
            }
        }
        return ret;
    })(
        [
            ["|"],
            ["and"],
            ["==", "!="],
            ["<", ">", "<=", ">="],
            ["+", "-"],
            ["*", "/", "%"]
        ],
        {}
    );

    var expr_op = function(left: AST_Node, min_prec) {
        var op: string = is(TokenType.Operator) ? S.token.value : null;
        var prec = op != null ? PRECEDENCE[op] : null; // if op is = here PRECEDENCE would return -1
        if (prec != null && prec > min_prec) { // if op is = prec would be -1 and following code won't execute
            next();
            var right = expr_op(expr_atom(), prec);
            return expr_op(new AST_Binary(left.start, left, op, right, right.end), min_prec);
        }
        return left;
    };

    function expr_ops() {
        return expr_op(expr_atom(), 0);
    }

    //later checking must ensure no custom variable can reference any system managed variables such as q1, q2, q1.r1 and so on.
    //for instance, `def a = q1` is illegal.
    //further more, system managed variables and their properties are read only.
    //for instance, `q1.text = "hello"` is illegal.
    //to change properties, use a built in command.
    function is_assignable(expr) {
        //given above restrictions, expr cannot be AST_Dot, since you cannot define custom structs (which has properties), nor can
        //you assign a new value to a system managed variable's property using `=`
        return expr instanceof AST_SymbolRef; //declaration is handled separately.
    }

    function maybe_assign() {
        var start = S.token;
        var left = expr_ops();
        if (is(TokenType.Operator, "=")) {
            if(is_assignable(left)) {
                next();
                return new AST_Assign(start, left, expr_ops(), prev());
            }
            parse_error("SyntaxError: Invalid assignment");
        }
        return left;
    }

    function expression(): AST_Node{
        return maybe_assign();
    }

    function attribute(): AST_Attribute{
        if(is(TokenType.KW_AT)) {
            let left = match_token(TokenType.KW_AT);
            if(is(TokenType.Operator, "=")){
                next();
                let valNode: AST_Node;
                if(is(TokenType.String)) {
                    valNode = expr_atom();
                } else if(is(TokenType.EES)) {
                    throw new Error("not yet implemented");
                } else {
                    parse_error("SyntaxError: value of an attribute must be either a string or an embedded expression, but found " + S.token.value);
                }
                return new AST_Attribute(left, left.value, valNode, false, valNode.end);
            } else {
                return new AST_Attribute(left, left.value, null, false, left);
            }
        } else if(is(TokenType.Identifier)) {
            let left = match_token(TokenType.Identifier);
            return new AST_Attribute(left, left.value, null, true, left);
        }
        js_error("SyntaxError: Invalid attribute name " + S.token.value, S.token.tokLine, S.token.tokPos);
    }

    function text(): AST_Node{
        if(is(TokenType.Text)) {
            let t = match_token(TokenType.Text);
            return new AST_String(t);
        } else if (is(TokenType.EES)) {
            throw new Error("not yet implemented");
        }
        parse_error("SyntaxError: Invalid question text");
    }

    function questionAttrib(){
        match_token(TokenType.QAS); //skip the <<
        let attributes: AST_Attribute[] = [];
        while(!is(TokenType.QAE)) {
            attributes.push(attribute());
        }
        match_token(TokenType.QAE);
        return attributes;
    }

    function _questionTexts(): AST_Node[]{
        let texts: AST_Node[] = [];
        while(!isOfAnyType([TokenType.EOF, TokenType.OAS, TokenType.ALBS, TokenType.QAS])) {
            texts.push(text());
        }
        return texts;
    }

    function optionAttrib(){
        match_token(TokenType.OAS);
        let option_attributes: AST_Attribute[] = [];
        while(!is(TokenType.OAE)){
            option_attributes.push(attribute());
        }
        match_token(TokenType.OAE);
        return option_attributes;
    }
    
    function optionText(): AST_Node[]{
        let texts: AST_Node[] = [];
        while(!isOfAnyType([TokenType.EOF, TokenType.OAS, TokenType.ALBS, TokenType.QAS])) {
            texts.push(text());
        }
        return texts;
    }

    function _options(): AST_Option[]{
        let ret: AST_Option[] = [];
        while(!isOfAnyType([TokenType.EOF, TokenType.QAS, TokenType.ALBS])) {
            let start = S.token;
            let option_attributes = optionAttrib();
            let option_texts = optionText();
            let end = prev();

            let isCol = false;
            for(let attr of option_attributes) {
                if(attr.name === "col") {
                    isCol = true;
                    break;
                }
            }

            if(isCol) {
                ret.push(new AST_Column(start, option_texts, option_attributes, end));
            } else {
                ret.push(new AST_Row(start, option_texts, option_attributes, end));
            }
        }
        return ret;
    }

    function question(){
        let start = S.token;
        //handle question attributes
        let questionAttributes = questionAttrib(); //!!!actually this can also be section attributes
        if(!is(TokenType.QAS) && !is(TokenType.ALBS)) {
            //test above is used to cater the case in which i have just seen section attributes, which are immediately followed by another question/section or interlude
            //if reaches here then i should be parsing a question, and i will expect its text, rows and columns
            let questionTexts = _questionTexts();
            let options = _options();
            let rows = options.filter(function(op) {
                return op instanceof AST_Row;
            });
            let columns = options.filter(function(op){
                return op instanceof AST_Column;
            });
            return new AST_Question(start, questionTexts, questionAttributes, rows, columns, prev());
        } else {
            return new AST_Section(start, questionAttributes, prev());
        }
    }

    function interlude(){
        match_token(TokenType.ALBS);
        while(!is(TokenType.ALBE)) {
            statement();
        }
        match_token(TokenType.ALBE);
    }



    function block_statement(){

    }

    function simple_statement(){
        return new AST_SimpleStatement(S.token, expression(), prev());
    }

    function statement() {
        //a statement can start with the following tokens
        switch (S.token.type) {
            case TokenType.String:
            case TokenType.Num:
            case TokenType.KW_Val_AL:
            case TokenType.Identifier:
                return simple_statement();
            case TokenType.Punc:
                if(is(TokenType.Punc, "("))
                    return simple_statement();
                break;
            case TokenType.KW_Call_AL:
                //these built-in calls cannot be part of an expression.
                //handle built in function calls
                break;
            case TokenType.KW_AL:
                switch (S.token.value) {
                    case "rule":
                        //handle rule definition
                    case "action":
                        //handle action definition
                    case "conditions":
                        //handle conditions
                    case "def":
                        //handle variable definition
                    case "answer":
                        //answer for ... has / only_has ... is treated like a function call in js, unlike `TokenType.KW_Call_AL`, it can
                        //be part of an expression.
                        return simple_statement();
                    default:
                        unexpected();
                }
                break;
            default:
                unexpected();
        }
    }

    return parse;

}