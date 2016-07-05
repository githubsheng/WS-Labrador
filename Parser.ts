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
                //handle interlude
            }
        }
    }
    
    function atom_node(): AST_Node{
        var tok = S.token, ret;
        switch (tok.type) {
            case TokenType.Identifier:
                ret = new AST_SymbolRef(tok); //symbol declaration will be handled separately.
                break;
            case TokenType.Num:
                ret = new AST_Num(tok);
                break;
            case TokenType.String:
                ret = new AST_String(tok);
                break;
            case TokenType.KW_Val_AL:
                switch (tok.value) {
                    case "false":
                        ret = new AST_False(tok);
                        break;
                    case "true":
                        ret = new AST_True(tok);
                        break;
                    case "undefined":
                        ret = new AST_Undefined(tok);
                        break;
                }
                break;
        }
        next();
        return ret;
    }

    function attribute(): AST_Attribute{
        if(is(TokenType.KW_AT)) {
            let left = match_token(TokenType.KW_AT);
            if(is(TokenType.Operator, "=")){
                next();
                let valNode: AST_Node;
                if(is(TokenType.String)) {
                    valNode = atom_node();
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
        //consume <%
        //while next token is not %>, call statement
        //consume %>
    }

    function simple_statement(){

    }

    function block_statement(){

    }
    
    function statement() {
        var tmp;
        //a statement can start with the following tokens
        switch (S.token.type) {
            case TokenType.String:
            case TokenType.Num:
            case TokenType.KW_Val_AL:
            case TokenType.Identifier:
                return simple_statement();
            case TokenType.KW_Call_AL:
                //handle built in function calls
                break;
            case TokenType.KW_AL:
                switch (tmp = S.token.value, next(), tmp) {
                    case "rule":
                        //handle rule definition
                    case "action":
                        //handle action definition
                    case "conditions":
                        //handle conditions
                    case "def":
                        //handle variable definition
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