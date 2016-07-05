///<reference path="Utils.ts"/>
/**
 * Created by wangsheng on 1/7/16.
 */

enum TokenType {
    String, Identifier, Num, Punc, Operator, EOF, //shared

    KW_AL, KW_Call_AL, KW_Val_AL,

    Text, KW_AT, QAS/*question attributes start*/, QAE/*question attributes end*/, OAS/*option attributes start*/,
    OAE/*option attributes end*/, EES/*embedded expression start*/, EEE/*embedded expression end*/,
    ALBS/*al block start*/, ALBE
}

interface Scope {
    define:(symbol: Symbol)=> void; //todo: here I should not deal with AST_Node but something like VariableSymbol, a different type of class
    resolve:(name: string) => Symbol; //here to review
}

class Symbol {
    public name: string;
    public definedInScope: Scope;
    constructor(name: string, definedInScope: Scope) {
        this.name = name;
        this.definedInScope = definedInScope;
    }
}

class VariableSymbol extends Symbol {
    constructor(name: string, definedInScope: Scope) {
        super(name, definedInScope);
    }
}

class RuleSymbol extends Symbol {
    public conditions: AST_SimpleStatement[];
    public action: AST_BlockStatement;
    constructor(name: string, definedInScope: Scope, conditions: AST_SimpleStatement[], action: AST_BlockStatement) {
        super(name, definedInScope);
        this.conditions = conditions;
        this.action = action;
    }
}

class ActionSymbol extends Symbol {
    public action: AST_BlockStatement;
    constructor(name: string, definedInScope: Scope, action: AST_BlockStatement) {
        super(name, definedInScope);
        this.action = action;
    }
}

class ConditionSetSymbol extends Symbol {
    public conditions: AST_SimpleStatement[];
    constructor(name: string, definedInScope: Scope, conditions: AST_SimpleStatement[]) {
        super(name, definedInScope);
        this.conditions = conditions;
    }
}

abstract class BaseScope implements Scope {

    private enclosingScope: Scope; //null for global scope
    private symbols: Map<Symbol> = new Map<Symbol>();

    constructor(enclosingScope: Scope) {
        this.enclosingScope = enclosingScope;
    }

    public define(symbol: Symbol) {
        this.symbols.set(symbol.name, symbol);
        symbol.definedInScope = this;
    }

    public resolve(name: string): Symbol {
        var s = this.symbols.get(name);
        if(s !== null) return s;
        if(this.enclosingScope !== null) return this.enclosingScope.resolve(name);
        return null;
    }

}

class GlobalScope extends BaseScope {
    constructor(){
        super(null);
    }
}

class InterludeScope extends BaseScope {
    constructor(parent: GlobalScope){
        super(parent);
    }
}

class BlockScope extends BaseScope {
    constructor(parent: Scope) {
        super(parent);
    }
}

abstract class ScopedSymbol extends Symbol implements Scope {
    private enclosingScope: Scope;
    private fields: Map<Symbol> = new Map<Symbol>();

    constructor(name: string, definedInScope: Scope) {
        super(name, definedInScope);
        this.enclosingScope = definedInScope;
    }

    public define(symbol: Symbol) {
        this.fields.set(symbol.name, symbol);
        symbol.definedInScope = this;
    }

    public resolve(name: string): Symbol {
        var s = this.fields.get(name);
        if(s !== null) return s;
        if(this.enclosingScope !== null) return this.enclosingScope.resolve(name);
        return null;
    }

    public resolveMember(name: string): Symbol {
        return this.fields.get(name);
    }
}

class QuestionSymbol extends ScopedSymbol {
    constructor(name: string, definedInScope: Scope) {
        super(name, definedInScope);
    }
}

class RowSymbol extends ScopedSymbol {
    constructor(name: string, definedInScope: Scope) {
        super(name, definedInScope);
    }
}

class ColumnSymbol extends ScopedSymbol {
    constructor(name: string, definedInScope: Scope) {
        super(name, definedInScope);
    }
}

class AST_Token {
    type: TokenType;
    value: any;
    tokPos: number;
    tokLine: number;

    constructor(type: TokenType, value: any, tokPos: number, tokLine: number) {
        this.type = type;
        this.value = value;
        this.tokPos = tokPos;
        this.tokLine = tokLine;
    }
}

class AST_Node {
    symbol: Symbol; //null if this field does not apply for the node
    constructor(public start: AST_Token, public end: AST_Token){}
}

class AST_SurveyComponent extends AST_Node {
}

class AST_Question extends AST_SurveyComponent {
    text: AST_Node[]; //an array of string and expressions...
    attributes: AST_Attribute[];
    rows: AST_Row[];
    columns: AST_Column[];
    constructor(public start: AST_Token, text: AST_Node[], attributes: AST_Attribute[], rows: AST_Row[], columns: AST_Column[], public end: AST_Token) {
        super(start, end);
        this.text = text;
        this.attributes = attributes;
        this.rows = rows;
        this.columns = columns;
    }
}

class AST_Section extends AST_SurveyComponent {
    attributes: AST_Attribute[];
    constructor(start: AST_Token, attributes: AST_Attribute[], end: AST_Token){
        super(start, end);
        this.attributes = attributes;
    }
}

class AST_Interlude extends AST_SurveyComponent {
    attributes: AST_Attribute[];
    body: AST_Node[]; //inside interlude there should not be section, question, row, column definitions related nodes.
    constructor(start: AST_Token, attributes: AST_Attribute[], body: AST_Node[], end: AST_Token){
        super(start, end);
        this.attributes = attributes;
        this.body = body;
    }
}

class AST_Option extends AST_Node {
    text: AST_Node[];
    attributes: AST_Attribute[];
    constructor(start: AST_Token, text: AST_Node[], attributes: AST_Attribute[], end: AST_Token){
        super(start, end);
        this.text = text;
        this.attributes = attributes;
    }
}

class AST_Row extends AST_Option {
    constructor(start: AST_Token, text: AST_Node[], attributes: AST_Attribute[], end: AST_Token){
        super(start, text, attributes, end);
    }
}

class AST_Column extends AST_Option {
    constructor(start: AST_Token, text: AST_Node[], attributes: AST_Attribute[], end: AST_Token){
        super(start, text, attributes, end);
    }
}

class AST_Attribute extends AST_Node {
    isCustom: boolean;
    name: string;
    value: AST_Node; //null if there is no value
    constructor(start: AST_Token, name: string, value: AST_Node, isCustom: boolean, end: AST_Token) {
        super(start, end);
        this.name = name;
        this.value = value;
        this.isCustom = isCustom;
    }
}

class AST_Statement extends AST_Node {
}

class AST_SimpleStatement extends AST_Statement {
    public body: AST_Node; //this should not be another statement
    constructor(start: AST_Token, body: AST_Node, end: AST_Token) {
        super(start, end);
        if(body instanceof AST_Statement) {
            throw new JS_Parse_Error("the body of a simple statement cannot be another statement", this.start.tokLine, this.start.tokPos);
        }
        this.body = body;
    }
}

class AST_BlockStatement extends AST_Statement {
    public body: AST_SimpleStatement[];
    constructor(start: AST_Token, body: AST_SimpleStatement[], end: AST_Token) {
        super(start, end);
        this.body = body;
    }
}

class AST_ConditionSetDef extends AST_Statement {
    public name: AST_SymbolDec;
    public body: AST_SimpleStatement[];
    constructor(start: AST_Token, name: AST_SymbolDec, body: AST_SimpleStatement[], end: AST_Token) {
        super(start, end);
        this.name = name;
        this.body = body;
    }
}

class AST_ActionDef extends AST_Statement {
    public name: AST_SymbolDec;
    public body: AST_BlockStatement;
    constructor(start: AST_Token, name: AST_SymbolDec, body: AST_BlockStatement, end: AST_Token) {
        super(start, end);
        this.name = name;
        this.body = body;
    }
}

class AST_RuleDef extends AST_Statement {
    public name: AST_SymbolDec;
    public conditions: AST_SimpleStatement[];
    public action: AST_BlockStatement;
    constructor(start: AST_Token, name: AST_SymbolDec, conditions: AST_SimpleStatement[], action:AST_BlockStatement, end: AST_Token) {
        super(start, end);
        this.name = name;
        this.conditions = conditions;
        this.action = action;
    }
}

class AST_VarDef extends AST_Statement {
    public name: AST_SymbolDec;
    public value: AST_Node;
    constructor(start: AST_Token, name: AST_SymbolDec, value: AST_Node, end: AST_Token) {
        super(start, end);
        this.name = name;
        this.value = value; //should be null if there is no value
    }
}

//following are mostly used as the body of a simple statement
class AST_Call extends AST_Node {
    public funcName: AST_SymbolRef;
    public args: AST_Node[];
    constructor(start: AST_Token, funcName: AST_SymbolRef, args: AST_Node[], end: AST_Token) {
        super(start, end);
        this.funcName = funcName;
        this.args = args;
    }
}

class AST_HasAnswer extends AST_Node {
    public question: AST_SymbolRef;
    public answers: AST_SymbolRef[];
    constructor(start: AST_Token, question: AST_SymbolRef, answers: AST_SymbolRef[], end: AST_Token) {
        super(start, end);
        this.question = question;
        this.answers = answers;
    }
}

class AST_PropAccess extends AST_Node {
    public container: AST_PropAccess | AST_SymbolRef;
    public property: AST_SymbolRef;
    constructor(start: AST_Token, container: AST_PropAccess | AST_SymbolRef, property: AST_SymbolRef, end: AST_Token) {
        super(start, end);
        this.container = container;
        this.property = property;
    }
}

class AST_Binary extends AST_Node {
    public left: AST_Node;
    public operator: string;
    public right: AST_Node;
    constructor(start: AST_Token, left: AST_Node, operator: string, right: AST_Node, end: AST_Token) {
        super(start, end);
        this.left = left;
        this.operator = operator;
        this.right = right;
        this.end = end;
    }
}

class AST_Assign extends AST_Binary {
    constructor(start: AST_Token, left: AST_Node, operator: string, right: AST_Node, end: AST_Token) {
        super(start, left, "=", right, end);
    }
}

class AST_Symbol extends AST_Node {
    public name: string;
    constructor(start: AST_Token, name: string, end: AST_Token) {
        super(start, end);
        this.name = name;
    }
}

class AST_SymbolDec extends AST_Symbol {
    public init: AST_Node;
    constructor(start: AST_Token, name: string, init: AST_Node, end: AST_Token) {
        super(start, name, end);
        this.init = init;
    }
}

class AST_SymbolRef extends AST_Symbol {
    constructor(nameToken: AST_Token) {
        super(nameToken, nameToken.value, nameToken);
    }
}

class AST_String extends AST_Node {
    public value: string;
    constructor(stringToken: AST_Token) {
        super(stringToken, stringToken);
        this.value = stringToken.value;
    }
}

class AST_Num extends AST_Node {
    public value: number;
    constructor(numToken: AST_Token) {
        super(numToken, numToken);
        this.value = numToken.value;
    }
}

class AST_True extends AST_Node {
    constructor(booleanToken: AST_Token) {
        super(booleanToken, booleanToken);
    }
}

class AST_False extends AST_Node {
    constructor(booleanToken: AST_Token) {
        super(booleanToken, booleanToken);
    }
}

class AST_Undefined extends AST_Node {
    constructor(undefinedToken: AST_Token) {
        super(undefinedToken, undefinedToken);
    }
}


