/**
 * Created by wangsheng on 29/6/16.
 */

///<reference path="Utils.ts"/>
///<reference path="AST_Token.ts"/>

function Tokenizer($TEXT:string) {

    function token(type:string, value:string) {
        return new AST_Token(type, value, S.tokPos, S.tokLine);
    }

    //status
    let S = {
        text: $TEXT.replace("\r\n", "\n"), //todo: verify whether this is necessary for ace editor
        pos: 0,
        line: 1,
        tokPos: 0, //used to record the starting pos of the next token
        tokLine: 0, //used to record the line of the next token
        mode: next_token
    };

    //following are token types of al
    var calls_al = "has has_not only_has go_to hide terminate show_error randomize_rows rotate_rows randomize_columns rotate_columns resume_row_order resume_column_order rotate_questions randomize_questions resume_question_order query evaluate";

    //all al keywords, use this to determine whether an identifier is a keyword or not. for instance, i need to make sure the `variableName` in `def variableName: 1;` is not a keyword
    var KEYWORDS_AL = makePredicate("true false undefined and def rule action conditions " + calls_al);

    //help me to find out whether an identifier is actually a function call. in al there is no ( ) and therefore i cannot use ( ) to find out.
    var KEYWORDS_CALL_AL = makePredicate(calls_al);

    //the start char of an operator, used for next_token to predicate whether i am going to handle an operator. "/" and "and" handled by "handle_slash" and "read_identifier_al" separately
    var OPERATORS_START_CHAR = makePredicate("+ - * % = < > !");

    //all operators in al
    var OPERATORS_AL = makePredicate(["==", "<", "<=", ">", ">=", "==", "!=", "+", "-", "*", "/", "%", "!", "and"]);

    var KEYWORDS_VALUE_AL = makePredicate("true false undefined");

    //used in next_token to predicate whether im going to handle a punctuation. dot is also a punctuation, it is separately handled by `handle_dot`
    var PUNC_CHARS_AL = makePredicate("{ } ( ) , | :"); //example: `action {...}` `(1+2)*4` `hide q1, q2, q3`. ${, }, [, ], << >> <% and %> are handled separately

    //following are token types of at
    //use this to find out whether an attribute is the name of a question/row/column or an built-in attribute. for instance << q1 hide="true" >>, q1 is the name, and hide is an built-in attribute
    var KEYWORDS_AT = makePredicate("name hide can_skip fixed after before rotate_rows randomize_rows rotate_columns randomize_columns minimal_selections maximum_selections single_choice multiple_choice single_choice_matrix multi_choice_matrix text number minimal_value maximum_value rotate_questions randomize_questions data xor all default type");

    function is_letter(code: number | string) {
        if(typeof code === "string") code = (<string>code).charCodeAt(0);
        return (code >= 97 && code <= 122) || (code >= 65 && code <= 90);
    }

    function is_digit(code: number | string) {
        if(typeof code === "string") code = (<string>code).charCodeAt(0);
        return code >= 48 && code <= 57;
    }

    //keywords naming convention also obeys this rule
    function is_identifier_char(code: number | string) {
        if(typeof code === "string") code = (<string>code).charCodeAt(0);
        //_, $, number, or letter
        return is_identifier_start(code) || is_digit(code);
    }

    //keywords naming convention also obeys this rule
    function is_identifier_start(code: number | string) {
        if(typeof code === "string") code = (<string>code).charCodeAt(0);
        //the start of an identifier must be either _, $, or letter
        return code == 36 || code == 95 || is_letter(code);
    }

    function peek(ahead:number): string {
        let i = S.pos + ahead - 1;
        if (i < S.text.length) return S.text.charAt(i);
        return null;
    }

    //if I have reached to the end of the source, return null, otherwise return the char
    //line number is increased after consuming a \n char.
    function consume():string {
        if (S.pos >= S.text.length) return null;
        let ch = S.text.charAt(S.pos++);
        if (ch === "\n") ++S.line;
        return ch;
    }

    function forward(i) {
        while (i-- > 0) consume();
    }

    //find the index of the closet eol from S.pos
    function find_eol():number {
        var text = S.text;
        for (var i = S.pos, n = S.text.length; i < n; ++i) {
            var ch = text[i];
            if (ch == "\n") return i;
        }
        return -1;
    }

    //read a word, depending on which mode we are (AL, AT), the word may or may not be a key word
    function read_identifier():string {
        var word = "", ch: string;
        //all key words, both in al, at and identifiers use the same set of chars
        while ((ch = peek(1)) != null && is_identifier_char(ch.charCodeAt(0))) {
            word += consume();
        }
        return word; //only time we call read_word is when I peek(1) and the returned char is the start of an identifier. which means `word` will at least has one character
    }

    //continue build ret until predicate returns false. see read_num to find out how to use it
    function read_while(predicate:() => boolean) {
        var ret = "";
        while (predicate())
            ret += consume();
        return ret;
    }

    function skip_line_comment() {
        let i = find_eol();
        //if the comment goes all the way to the end of the source, place S.pos to $TEXT.length so that
        //it looks the same as if i have consumed the very last char.

        //if the comment does not go all the way to the end of the source, set S.pos to the index of \n
        //character, so next consume call would consume the \n and cause S.line to increase.
        S.pos = i === -1 ? S.text.length : i;
        return null;
    }

    function skip_whitespace() {
        while (peek(1) === " " || peek(1) === "\n") consume();
    }

    function read_escaped_char() {
        var ch = consume();
        switch (ch.charCodeAt(0)) {
            case 110 : //n
            case 114 : //r
                return "\n";
            case 116 :
                return "\t";
        }
        return ch;
    }

    function testIfPeekIs(pattern:string) {
        for (let i = 0; i < pattern.length; i++) {
            if (peek(1 + i) !== pattern[i]) return false;
        }
        return true;
    }

    //text means the question text, row text or column text, it is different than string which is surrounded by " or ' and used in
    //al
    function read_text() {
        var text = read_while(function () {
            return !(testIfPeekIs("<<") || testIfPeekIs("${") || testIfPeekIs("<%") || testIfPeekIs("[") || peek(1) === null);
        });
        return token("text", text.trim());
    }

    function read_identifier_at() {
        var w = read_identifier();
        if (KEYWORDS_AT(w)) return token("kw_at", w);
        return token("identifier", w);
    }

    function read_identifier_al() {
        var w = read_identifier();
        if (KEYWORDS_VALUE_AL(w)) return token("kw_val_al", w); //true, false, undefined
        if (OPERATORS_AL(w)) return token("operator", w); //operator "and" match an identifier patter, but is really an operator
        if (KEYWORDS_CALL_AL(w)) return token("kw_call_al", w); //function call in al
        if (KEYWORDS_AL(w)) return token("kw_al", w);
        return token("identifier", w);
    }

    function read_string() {
        var quote = consume() /* should be either \' or \" */, ret = "";
        for (; ;) {
            var ch = consume();
            if (ch == "\\") {
                ch = read_escaped_char(); //for example: if first ch is \ and second is n, really it should be one ch: \n
            } else if (ch == "\n") {
                parse_error("Unterminated string constant");
            } else if (ch == quote) {
                break;
            }
            ret += ch;
        }
        return token("string", ret);
    }

    function read_num(dot_prefix?:string) {
        var has_dot = dot_prefix == ".";
        var num = read_while(function () {
            var ch = peek(1);
            if (ch === ".") return !has_dot ? (has_dot = true) : false; //return false because i cannot have two dots in a number
            return is_digit(ch);
        });
        if (dot_prefix) num = dot_prefix + num;
        var val = parseFloat(num);
        if (!isNaN(val)) {
            return token("num", val.toString());
        } else {
            parse_error("Invalid syntax: " + num);
        }
    }

    function read_operator(prefix?:string) {
        //for example, if i have consumed +, and peek reveals next char is also +, then i just "grow" the
        //current operator from + to ++;
        function grow(op:string) {
            if (!peek(1)) return op;
            var bigger = op + peek(1);
            if (OPERATORS_AL(bigger)) {
                consume();
                return grow(bigger);
            } else {
                return op;
            }
        }

        return token("operator", grow(prefix || consume()));
    }

    //if it turns out to be an operator, such as /, or /=, then return that operator.
    //if it turns out to be a comment, just return undefined.
    function handle_slash() {
        consume(); //have just consumed a /
        if (peek(1) === "/") {
            //if peek reveals another /, // pattern is confirmed.
            consume(); //consume the second / and skip the rest of the line.
            return skip_line_comment();
        }
        return read_operator("/"); //turns out the / consumed at the beginining of this method is an operator.
    }

    function handle_dot() {
        consume(); //consume the dot
        return is_digit(peek(1).charCodeAt(0))
            ? read_num(".")
            : token("punc", ".");
    }

    function start_token() {
        S.tokLine = S.line;
        S.tokPos = S.pos;
    }

    interface next_token {
        ():AST_Token;
    }

    var text_mode:next_token = function () {
        if(peek(1) === null) return token("eof", "eof");
        if (testIfPeekIs("<<")) {
            forward(2);
            S.mode = question_attribute_mode;
            return token("q_attr_start", "<<"); //question / section attributes section start
        }
        if (testIfPeekIs("[")) {
            consume();
            S.mode = option_attribute_mode;
            return token("o_attr_start", "["); //option attributes section start
        }
        if (testIfPeekIs("${")) {
            forward(2);
            S.mode = get_ee_mode(text_mode);
            return token("ee_start", "${"); //embedded expression start
        }
        if (testIfPeekIs("<%")) {
            forward(2);
            S.mode = al_block_mode;
            return token("alb_start", "<%"); //al block start
        }
        start_token();
        return read_text();
    };

    S.mode = text_mode;

    var question_attribute_mode: next_token = function(){
        function end_mode_handler(){
            forward(2);
            S.mode = text_mode;
            return token("q_attr_end", ">>"); //option attributes section end
        }
        return attribute_mode(">>", end_mode_handler);
    };

    var option_attribute_mode: next_token = function(){
        function end_mode_handler(){
            consume();
            S.mode = text_mode;
            return token("o_attr_end", "]"); //option attributes section end
        }
        return attribute_mode("]", end_mode_handler);
    };

    function attribute_mode (end_mode_string:string, end_mode_handler:() => AST_Token):AST_Token {
        skip_whitespace();
        start_token();
        if (testIfPeekIs(end_mode_string)) return end_mode_handler();
        if (testIfPeekIs("${")) {
            forward(2);
            S.mode = get_ee_mode(question_attribute_mode);
            return token("ee_start", "${"); //embedded expression start
        }

        var ch = peek(1);
        if (ch === null) return token("eof", "eof");
        if (ch === "\"" || ch === "\'") return read_string();
        if (ch === "=") return token("punc", consume());
        if (is_identifier_start(ch.charCodeAt(0))) return read_identifier_at();

        parse_error("Unexpected character '" + ch + "'");
    }

    function get_ee_mode(current_mode:next_token):next_token {
        return function () {
            function handle_ee_mode_termination() {
                consume(); //consume }
                S.mode = current_mode; //set the mode to the previous mode. for instance, if the ee is in text, then I go back to text mode. if the ee is in question attributes section, i go back to attribute_mode
                return token("ee_end", "}");
            }
            return al_mode("}", handle_ee_mode_termination);
        }
    }

    //this is actually the next token method of al mode
    var al_block_mode:next_token = function () {

        function handle_percentage() {
            consume(); //consume %
            if (peek(1) == ">") {
                S.mode = text_mode;
                consume(); //consume >
                return token("alb_end", "%>"); //al block end
            }
            return token("punc", "%");
        }
        return al_mode("%", handle_percentage);
    };

    var al_mode = function (end_mode_predicate:string, end_mode_handler:() => AST_Token):AST_Token {
        for (; ;) {
            skip_whitespace();
            start_token();
            var ch = peek(1);
            if (!ch) return token("eof", "eof");
            if (ch === end_mode_predicate) return end_mode_handler();
            var code = ch.charCodeAt(0);
            switch (code) {
                case 34:
                case 39:
                    return read_string(); // \' or \"
                case 46:
                    return handle_dot();
                case 47: //a slash
                {
                    var tok = handle_slash();
                    if (tok === null) continue;
                    return tok;
                }
            }
            if (is_digit(code)) return read_num();
            if (PUNC_CHARS_AL(ch)) return token("punc", consume());
            if (OPERATORS_START_CHAR(ch)) return read_operator();
            if (is_identifier_start(code)) return read_identifier_al();

            //in case none of the conditions above are met, break the for loop. if the for loop ends this way it should be an error
            parse_error("Unexpected character '" + ch + "'");
        }
    };

    function next_token(): AST_Token {
        return S.mode();
    }

    //following defined errors.
    function parse_error(msg:string) {
        js_error(msg, S.tokLine, S.tokPos);
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

    return next_token;
}