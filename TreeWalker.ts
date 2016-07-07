///<reference path="Tree.ts"/>
/**
 * Created by wangsheng on 7/7/16.
 */

function Walker(root:AST_Root, preCallback:(node:AST_Node) => void, postCallback:(node:AST_Node) => void) {

    function walkTemplate<T extends AST_Node>(walk?:(node:T)=> void):(node:T) => void {
        return function (node:T) {
            if (preCallback) preCallback(node);
            if(walk) walk(node);
            if (postCallback) postCallback(node);
        }
    }

    function walkQuestion(node:AST_Question) {
        if (preCallback)preCallback(node);
        for (let textFrag of node.text)
            _walk(textFrag);
        for (let attribute of node.attributes)
            _walk(attribute);
        for (let row of node.rows)
            _walk(row);
        for (let col of node.columns)
            _walk(col);
        if (postCallback)postCallback(node);
    }

    function walkSection(node:AST_Section) {
        if (preCallback) preCallback(node);
        for (let attribute of node.attributes)
            _walk(attribute);
        if (postCallback) postCallback(node);
    }

    function walkInterlude(node:AST_Interlude) {
        if (preCallback) preCallback(node);
        for (let stmt of node.body) {
            _walk(stmt);
        }
        if (postCallback) postCallback(node);
    }

    var walkRow = walkTemplate<AST_Row>(function (node) {
        for (let textFrag of node.text)
            _walk(textFrag);
        for (let attribute of node.attributes)
            _walk(attribute);
    });

    var walkCol = walkTemplate<AST_Column>(function (node) {
        for (let textFrag of node.text)
            _walk(textFrag);
        for (let attribute of node.attributes)
            _walk(attribute);
    });

    var walkAttrib = walkTemplate<AST_Attribute>(function (node) {
        if(node.value) _walk(node.value);
    });

    var walkSimpleStatement = walkTemplate<AST_SimpleStatement>(function (node) {
        _walk(node.body);
    });

    var walkBlockStatement = walkTemplate<AST_BlockStatement>(function (node) {
        for (let stmt of node.body) {
            _walk(stmt);
        }
    });

    var walkConditionSetDef = walkTemplate<AST_ConditionSetDef>(function (node) {
        for (let condition of node.body)
            _walk(condition);
    });

    var walkActionDef = walkTemplate<AST_ActionDef>(function (node) {
        _walk(node.body);
    });

    var walkRuleDef = walkTemplate<AST_RuleDef>(function (node) {
        for (let condition of node.conditions)
            _walk(condition);
        _walk(node.action);
    });

    var walkCall = walkTemplate<AST_Call>(function (node) {
        _walk(node.target);
    });

    var walkBuiltInCmdCall = walkTemplate<AST_BuiltInCmdCall>(function (node) {
        for (let arg of node.args)
            _walk(arg);
    });

    var walkHasAnswer = walkTemplate<AST_HasAnswer>(function(node){
        _walk(node.question);
        for(let a of node.answers) {
            _walk(a);
        }
    });

    var walkBinary = walkTemplate<AST_Binary>(function(node){
        _walk(node.left);
       _walk(node.right);
    });

    var walkDot = walkTemplate<AST_Dot>(function(node){
        _walk(node.expression);
    });

    var walkSymbolDec = walkTemplate<AST_SymbolDec>(function(node){
        _walk(node.init);
    });

    var walkLeaf = walkTemplate<AST_Node>();

    function _walk(node:AST_Node) {
        switch (node.constructor["name"]) {
            case "AST_Question":
                walkQuestion(<AST_Question>node);
                break;
            case "AST_Section":
                walkSection(<AST_Section>node);
                break;
            case "AST_Interlude":
                walkInterlude(<AST_Interlude>node);
                break;
            case "AST_Row":
                walkRow(<AST_Row>node);
                break;
            case "AST_Column":
                walkCol(<AST_Column>node);
                break;
            case "AST_Attribute":
                walkAttrib(<AST_Attribute>node);
                break;
            case "AST_SimpleStatement":
                walkSimpleStatement(<AST_SimpleStatement>node);
                break;
            case "AST_BlockStatement":
                walkBlockStatement(<AST_BlockStatement>node);
                break;
            case "AST_ConditionSetDef":
                walkConditionSetDef(<AST_ConditionSetDef>node);
                break;
            case "AST_ActionDef":
                walkActionDef(<AST_ActionDef>node);
                break;
            case "AST_RuleDef":
                walkRuleDef(<AST_RuleDef>node);
                break;
            case "AST_Evaluate":
            case "AST_Do":
                walkCall(<AST_Call>node);
                break;
            case "AST_BuiltInCmdCall":
                walkBuiltInCmdCall(<AST_BuiltInCmdCall>node);
                break;
            case "AST_HasAnswer":
                walkHasAnswer(<AST_HasAnswer>node);
                break;
            case "AST_Binary":
            case "AST_Assign":
                walkBinary(<AST_Binary>node);
                break;
            case "AST_Dot":
                walkDot(<AST_Dot>node);
                break;
            case "AST_SymbolDec":
                walkSymbolDec(<AST_SymbolDec>node);
                break;
            case "AST_SymbolRef":
            case "AST_String":
            case "AST_Num":
            case "AST_True":
            case "AST_False":
            case "AST_Undefined":
                walkLeaf(node);
                break;
        }


    }

    return function(){
        for(let c of root.surveyComponents){
            _walk(c);
        }
    }


}