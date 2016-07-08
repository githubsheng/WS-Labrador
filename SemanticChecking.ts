/**
 * Created by wangsheng on 8/7/16.
 */
///<reference path="TreeWalker.ts"/>
///<reference path="extended.d.ts"/>

function SemanticChecking(root:AST_Root) {

    interface hasAttributes {
        attributes:AST_Attribute[];
        start:AST_Token;
    }

    function mapAttribToName(attribute:AST_Attribute) {
        return attribute.name;
    }

    function checkName(node:hasAttributes) {
        var custAttribs = node.attributes.filter(function (a:AST_Attribute) {
            return a.isCustom;
        }); //custom attributes are treated as names

        if (custAttribs.length === 0) {
            let message = "Question has no name";
            js_error(message, node.start.tokLine, node.start.tokPos);
        }

        if (custAttribs.length > 1) {
            let msg = "More than one name found: " + custAttribs.map(mapAttribToName).join(" ");
            js_error(msg, node.start.tokLine, node.start.tokPos);
        }

        let astAttrib = custAttribs[0];
        if (astAttrib.value !== null) {
            let msg = astAttrib.name + " is custom attribute and is used as name of the question, there should be no value assigned to this attribute";
            js_error(msg, astAttrib.start.tokLine, astAttrib.start.tokPos);
        }
    }

    function checkDuplicates(node:hasAttributes) {
        let attribs = node.attributes;

        attribs.sort(function (a, b) {
            if (a.name < b.name) return -1;
            if (a.name === b.name) return 0;
            if (a.name > b.name) return 1;
        });

        for (let i = 0; i < attribs.length - 1; i++) {
            if (attribs[i].name == attribs[i + 1].name) {
                let msg = "Duplicate attributes: " + attribs[i].name;
                js_error(msg, attribs[i].start.tokLine, attribs[i].start.tokPos);
            }
        }
    }

    function checkSameKindUtil(node:hasAttributes, attribNames:string[]) {
        let attribs = node.attributes;
        var r = attribs.filter(function (attrib) {
            return attribNames.indexOf(attrib.name) > -1;
        });
        if (r.length > 1) {
            let msg = "Duplicate kinds of attributes: " + r.map(mapAttribToName).join(", ");
            js_error(msg, r[0].start.tokLine, r[0].start.tokPos);
        }
    }

    function checkRowOrderMutualExclusive(node:AST_Question) {
        checkSameKindUtil(node, ["rotate_rows", "randomize_rows"]);
    }

    function checkColumnOrderMutualExclusive(node:AST_Question) {
        checkSameKindUtil(node, ["rotate_columns", "randomize_columns"]);
    }

    function checkQuestionTypeMutualExclusive(node:AST_Question) {
        checkSameKindUtil(node, "single_choice multiple_choice single_choice_matrix multi_choice_matrix text number".split(" "));
    }

    function checkXorAllOnOptions(node: AST_Question) {
        var questionType = findQuestionType(node);

        if(questionType == "number" || questionType == "text") return;

        var rowsHasXor= node.rows.filter(function(r){
            var rowAttribNames= r.attributes.map(mapAttribToName);
            if(rowAttribNames.indexOf("xor") > -1) return true;
        });

        var rowsHasAll = node.rows.filter(function(r){
            var rowAttribNames= r.attributes.map(mapAttribToName);
            if(rowAttribNames.indexOf("all") > -1) return true;
        });

        if((questionType === "single_choice_matrix" || questionType === "multi_choice_matrix")) {
            if(rowsHasXor.length > 0) js_error("xor attribute does not apply to rows in matrix questions", rowsHasXor[0].start.tokLine, rowsHasXor[0].start.tokPos);
            if(rowsHasAll.length > 0) js_error("'all' attribute does not apply to rows in matrix questions", rowsHasAll[0].start.tokLine, rowsHasAll[0].start.tokPos);
        }
    }

    function findQuestionType(node:AST_Question) {
        var allQuestionTypes = "single_choice multiple_choice single_choice_matrix multi_choice_matrix text number".split(" ");
        var type;
        node.attributes.forEach(function (a) {
            if (allQuestionTypes.indexOf(a.name) > -1) {
                type = a.name;
            }
        });
        if (type) return type;
        js_error("You need to specify questiont type", node.start.tokLine, node.start.tokPos);
    }

    function checkInAppropriateAttributes(node:AST_Question, questionTypes:string[], inAppropriateAttributeNames:string[]) {
        var questionType = findQuestionType(node);
        if (questionTypes.indexOf(questionType) > -1) {
            node.attributes.forEach(function (a) {
                if (inAppropriateAttributeNames.indexOf(a.name) > -1)
                    js_error(a.name + " does not apply to " + questionType + " questions", a.start.tokLine, a.start.tokPos);
            });
        }
    }

    function checkIfRowsRelatedApply(node:AST_Question) {
        var questionType = findQuestionType(node);
        //if question type is text or number, no rows / columns related are allowed
        if (questionType == "number" || questionType == "text") {
            if (node.rows.length > 0)
                js_error(questionType + " questions cannot have rows", node.rows[0].start.tokLine, node.rows[0].start.tokPos);

            checkInAppropriateAttributes(node, ["number", "text"], ["rotate_rows", "randomize_rows"]);
        }
    }

    function checkIfColumnsRelatedApply(node:AST_Question) {
        var questionType = findQuestionType(node);
        if (questionType == "number" || questionType == "text" || questionType == "single_choice" || questionType == "multiple_choice") {
            if (node.columns.length > 0)
                js_error(questionType + " questions cannot have columns", node.rows[0].start.tokLine, node.rows[0].start.tokPos);

            checkInAppropriateAttributes(node, ["number", "text", "single_choice", "multiple_choice"], ["rotate_columns", "randomize_columns"]);
        }
    }

    function checkIfSelectionBoundsApply(node:AST_Question) {
        checkInAppropriateAttributes(node, ["number", "text"], ["minimal_selections", "maximum_selections"]);
    }

    function checkIfValueBoundsApply(node:AST_Question) {
        checkInAppropriateAttributes(node, "single_choice multiple_choice single_choice_matrix multi_choice_matrix".split(" "), ["minimal_value", "maximum_value"]);
    }

    function checkOptionAllXorMutualExclusive(node:AST_Option) {
        checkSameKindUtil(node, ["xor", "all"]);
    }

    function checkIfAttribApplyToOption(node: AST_Option) {
        var legalAttribNamesForOptions = ["fixed", "data", "xor", "all", "col"];
        node.attributes.forEach(function(attrib){
            if(attrib.isCustom) return;

            if(legalAttribNamesForOptions.indexOf(attrib.name) === -1)
                js_error(attrib.name + " does not apply to option", attrib.start.tokLine, attrib.start.tokPos);
        })
    }

    function checkQuestionStructure(node:AST_Node) {
        if (node instanceof AST_Question) {
            checkName(node);
            checkDuplicates(node);
            checkRowOrderMutualExclusive(node);
            checkColumnOrderMutualExclusive(node);
            checkQuestionTypeMutualExclusive(node);
            checkIfRowsRelatedApply(node);
            checkIfColumnsRelatedApply(node);
            checkIfSelectionBoundsApply(node);
            checkIfValueBoundsApply(node);
            checkXorAllOnOptions(node);
        }

        if (node instanceof AST_Option) {
            checkName(node);
            checkIfAttribApplyToOption(node);
            checkDuplicates(node);
            checkOptionAllXorMutualExclusive(node);
        }
    }

    function checkAttributeValue(node: AST_Node){
        if(node instanceof AST_Attribute) {
            var attrib = node;
            switch(attrib.name) {
                case "rotate_rows":
                case "randomize_rows":
                case "rotate_columns":
                case "randomize_columns":
                    if(attrib.value !== null && !(attrib.value instanceof AST_SimpleStatement))
                        js_error(attrib.name + " either does not have value or has a simple expression as value", attrib.end.tokLine, attrib.end.tokPos);
                    break;
                case "minimal_selections":
                case "maximum_selections":
                case "minimal_value":
                case "maximum_value":
                    if(attrib.value instanceof AST_String) {
                        if(!Number.isInteger(+((<AST_String>attrib.value).value)))
                            js_error("cannot parse the value of " + attrib.name + " to an integer", attrib.start.tokLine, attrib.start.tokPos);
                        return;
                    }
                    if(attrib.value instanceof AST_SimpleStatement) return;
                    js_error(attrib.name + " needs to have a string or a simple expression as value", attrib.start.tokLine, attrib.start.tokPos);
                    break;
                case "data":
                    if(attrib.value == null || !(attrib.value instanceof AST_String))
                        s_error("data needs to have a string as value", attrib);
            }
        }

    }

    //build symbol table and define scopes

    //check if property access are legal

    Walker(root, checkQuestionStructure)();
    Walker(root, checkAttributeValue)();

}