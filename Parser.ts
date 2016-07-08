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

    function check_token(type: TokenType, val?: string): AST_Token {
        if (is(type, val)) return S.token;
        var msg = "SyntaxError: ";
        if(!val) {
            switch (type) {
                case TokenType.QAS:
                    val = "<<";
                    break;
                case TokenType.QAE:
                    val = ">>";
                    break;
                case TokenType.EES:
                    val = "[";
                    break;
                case TokenType.EEE:
                    val = "]";
                    break;
                case TokenType.ALBS:
                    val = "<%";
                    break;
                case TokenType.ALBE:
                    val = "%>";
                    break;
                case TokenType.Num:
                    val = "number";
                    break;
                case TokenType.String:
                    val = "string";
                    break;
                case TokenType.Operator:
                    val = "operator";
                    break;
                case TokenType.Text:
                    val = "text";
                    break;
                case TokenType.Identifier:
                    val = "identifier / name";
                    break;
            }
        }
        if(val) {
            msg += "expecting " + val + " but found " + S.token.value;
        } else {
            msg += "not expecting " + S.token.value;
        }


        js_error(msg, S.token.tokLine, S.token.tokPos);
    }

    function match_token(type: TokenType, val?: string): AST_Token {
        var ret = check_token(type, val);
        next();
        return ret;
    }

    function parse_error(message: string) {
        js_error(message, S.token.tokLine, S.token.tokPos);
    }

    function unexpected(token?: AST_Token) {
        if (token == null)
            token = S.token;
        js_error("unexpected token: " + token.value, token.tokLine, token.tokPos);
    }

    function maybe_propAccess(container: AST_Node){
        if(is(TokenType.Punc, ".") && (container instanceof AST_Dot|| container instanceof AST_SymbolRef)) {
            var propToken = next();
            if(is(TokenType.Identifier)) {
                next();
                return maybe_propAccess(new AST_Dot(container, propToken.value, propToken));
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
            ["and"],
            ["==", "!="],
            ["<", ">", "<=", ">="],
            ["+", "-"],
            ["*", "/", "%"]
        ],
        {}
    );

    var expr_op = function(left: AST_Node, min_prec): AST_Node {
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


    function block_statement(): AST_BlockStatement{
        var start = S.token;
        let stmts: AST_SimpleStatement[] = [];
        match_token(TokenType.Punc, "{");
        while(!is(TokenType.Punc, "}")) {
            stmts.push(simple_statement());
        }
        match_token(TokenType.Punc, "}");
        return new AST_BlockStatement(start, stmts, prev());
    }

    function simple_statement(){
        return new AST_SimpleStatement(S.token, expression(), prev());
    }

    function _condition(): AST_SimpleStatement{
        match_token(TokenType.Punc, "|");
        return simple_statement();
    }

    function _rule(){
        var start = S.token;
        let conditions: AST_SimpleStatement[] = [];
        match_token(TokenType.KW_AL, "rule");
        var name = match_token(TokenType.Identifier).value;
        match_token(TokenType.Punc, ":");
        conditions.push(_condition());
        while(!is(TokenType.Punc, "{")) {
            conditions.push(_condition());
        }
        return new AST_RuleDef(start, name, conditions, block_statement(), prev());
    }

    function _action(){
        var start = S.token;
        match_token(TokenType.KW_AL, "action");
        var name = match_token(TokenType.Identifier).value;
        return new AST_ActionDef(start, name, block_statement(), prev());
    }

    function _condition_set(){
        var start = S.token;
        match_token(TokenType.KW_AL, "conditions");
        var name = match_token(TokenType.Identifier).value;
        match_token(TokenType.Punc, ":");
        let conditions: AST_SimpleStatement[] = [];
        conditions.push(_condition());
        while(!is(TokenType.Punc, "end")) {
            conditions.push(_condition());
        }
        return new AST_ConditionSetDef(start, name, conditions, prev());
    }

    function _def(){
        var start = S.token;
        match_token(TokenType.KW_AL, "def");
        var name = match_token(TokenType.Identifier).value;
        if(is(TokenType.Operator, "=")) {
            match_token(TokenType.Operator, "=");
            return new AST_SymbolDec(start, name, expr_ops(), prev());
        } else {
            return new AST_SymbolDec(start, name, null, prev());
        }
    }

    function build_in_func_cmd(){
        var start = S.token;
        var cmdName = match_token(TokenType.KW_Cmd_AL).value;
        var args = _args_list();
        return new AST_BuiltInCmdCall(start, cmdName, args, prev());
    }

    function _evaluate(){
        var start = S.token;
        match_token(TokenType.KW_Cmd_AL, "evaluate");
        check_token(TokenType.Identifier);
        return new AST_Evaluate(start, symbol_ref(), prev());
    }

    function _do(){
        var start = S.token;
        match_token(TokenType.KW_Cmd_AL, "do");
        check_token(TokenType.Identifier);
        return new AST_Do(start, symbol_ref(), prev());
    }

    function statement(): AST_Statement {
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
            case TokenType.KW_Cmd_AL:
                //these built-in commands cannot be part of an expression.
                switch(S.token.value) {
                    case "evaluate":
                        return _evaluate();
                    case "do":
                        return _do();
                    case "go_to":
                    case "hide":
                    case "terminate":
                    case "show_error":
                        return build_in_func_cmd();
                }
                break;
            case TokenType.KW_AL:
                switch (S.token.value) {
                    case "rule":
                        return _rule();
                    case "action":
                        return _action();
                    case "conditions":
                        return _condition_set();
                    case "def":
                        return _def();
                    case "answer":
                        //answer for ... has / only_has ... is treated like a function call in js, unlike `TokenType.KW_Cmd_AL`, it can
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

    function interlude(){
        var start = S.token;
        let stmts: AST_Statement[] = [];
        match_token(TokenType.ALBS);
        while(!is(TokenType.ALBE)) {
            stmts.push(statement());
        }
        match_token(TokenType.ALBE);
        return new AST_Interlude(start, stmts, prev());
    }

    //parse will continue calling this method until reaching eof
    function parse() {
        let root = new AST_Root();
        while(S.token.type !== TokenType.EOF) {
            switch (S.token.type) {
                case TokenType.QAS:
                    root.surveyComponents.push(question());
                    break;
                case TokenType.ALBS:
                    root.surveyComponents.push(interlude());
                    break;
            }
        }
        return root;
    }


    return parse;

}