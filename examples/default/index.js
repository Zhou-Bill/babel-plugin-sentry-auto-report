'use strict';

var path = require('path');
var helperPluginUtils = require('@babel/helper-plugin-utils');
var template = require('@babel/template');
var core = require('@babel/core');

function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

var path__namespace = /*#__PURE__*/_interopNamespaceDefault(path);

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise */


var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};

var visitorTryStatement = {
    TryStatement: function (path) {
        if (path.node.processed) {
            path.skip();
            return;
        }
        /** 需要给try/catch 里面的东西进行上报 */
        path.traverse({
            CatchClause: function (catchNodePath) {
                var catchNode = catchNodePath.node;
                var catchBody = catchNode.body;
                path.node.processed = true;
                /** 如果catch 中已经包含了 sentry.captureException 那么就不需要添加 */
                var hasSentryCaptureException = catchBody.body.some(function (node) {
                    var _a, _b;
                    return node.type === 'ExpressionStatement' &&
                        node.expression.type === 'CallExpression' &&
                        node.expression.callee.type === 'MemberExpression' &&
                        ((_a = node.expression.callee.object) === null || _a === void 0 ? void 0 : _a.name) === 'sentry' &&
                        ((_b = node.expression.callee.property) === null || _b === void 0 ? void 0 : _b.name) === 'captureException';
                });
                if (hasSentryCaptureException) {
                    return;
                }
                var param = catchNode.param;
                /**
                 * 如果没有参数 那么就不需要添加
                 * try {
                 *   const data = await sleep()
                 * } catch {
                 *   console.log(123)
                 * }
                 */
                if (param === null || !(param === null || param === void 0 ? void 0 : param.name)) {
                    return;
                }
                /**
                 * 如果catch body 里面有内容 那么就需要进行上报
                 */
                catchBody.body.unshift(template.statement("sentry.captureException(".concat(param.name, ")"))());
            }
        });
    }
};
var index = helperPluginUtils.declare(function (api, options) {
    return {
        name: 'sentry-auto-report',
        pre: function (file) {
            this.set('imported', []);
        },
        visitor: __assign(__assign({ Program: {
                enter: function (path, state) {
                    var imported = false;
                    /** 如果没有找到sentry 那么就导入他 */
                    path.traverse({
                        ImportDeclaration: function (importNodePath) {
                            var importNode = importNodePath.node;
                            var importSource = importNode.source;
                            if (importSource.value === 'sentry') {
                                imported = true;
                            }
                        }
                    });
                    if (!imported) {
                        /** https://babeljs.io/docs/babel-template#templatestatement */
                        path.node.body.unshift(api.template.statement('import * as sentry from \'sentry\'')());
                    }
                }
            } }, visitorTryStatement), { 
            /**
             * 处理 await 后面跟着的catch
             * const data = await sleep().catch(() => {})
             */
            AwaitExpression: function (path, state) {
                var _a, _b, _c, _d, _e, _f;
                var node = path.node;
                var argument = node.argument;
                var t = api.types;
                if ((path.node).processed) {
                    path.skip();
                    return;
                }
                if (t.isCallExpression(argument) && ((_b = (_a = argument.callee) === null || _a === void 0 ? void 0 : _a.property) === null || _b === void 0 ? void 0 : _b.name) !== 'catch') {
                    var catchIdentifier = t.identifier('catch');
                    var errorFunc = t.arrowFunctionExpression([t.identifier('error')], t.blockStatement([
                        t.expressionStatement(t.callExpression(t.memberExpression(t.identifier('sentry'), t.identifier('captureException')), [t.identifier('error')]))
                    ]));
                    var catchExpression = t.callExpression(t.memberExpression(argument, catchIdentifier), [errorFunc]);
                    path.replaceWith(t.awaitExpression(catchExpression));
                    path.skip();
                    return;
                }
                if (t.isCallExpression(argument) &&
                    (((_c = (argument)) === null || _c === void 0 ? void 0 : _c.callee).type !== 'MemberExpression' ||
                        ((_d = ((argument).callee)) === null || _d === void 0 ? void 0 : _d.property).name !== 'catch')) {
                    return;
                }
                var args = argument.arguments;
                if (args.length === 0) {
                    return;
                }
                /** catch 回调函数 */
                var catchCallback = args[0];
                if (!catchCallback.body) {
                    return;
                }
                var params = catchCallback.params;
                path.node.processed = true;
                /** 如果没有参数,  */
                if (params.length === 0) {
                    catchCallback.params = [api.types.identifier('error')];
                }
                var paramsName = (_f = (_e = catchCallback.params) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.name;
                var callbackBody = catchCallback.body.body;
                var hasSentryCaptureException = callbackBody.some(function (node) {
                    return node.type === 'ExpressionStatement' && node.expression.callee.object.name === 'sentry';
                });
                /** 如果有加入sentry，那么就不处理 */
                if (hasSentryCaptureException) {
                    return;
                }
                var element = api.types.callExpression(api.types.identifier('sentry.captureException'), [api.types.identifier(paramsName)]);
                catchCallback.body.body.unshift(element);
            }, FunctionDeclaration: function (path, state) {
                var isAsync = path.node.async;
                /**
                 * 如果不是 async/await 函数 那么就跳过
                 */
                if (!isAsync) {
                    /** 跳过当前节点 以及它的子节点 */
                    path.skip();
                    return;
                }
                var body = path.node.body.body;
                var hasTryCatch = body.some(function (node) {
                    return node.type === 'TryStatement';
                });
                // /**
                //  * 首先先判断它是否含有try catch 语句 或者所有有catch语句
                //  * 如果有的话 那么就不需要再次添加，然后直接添加 sentry.captureException
                //  * 如果没有的话 那么就需要添加
                //  */
                if (hasTryCatch) {
                    // 如果有try catch 那么直接使用上面的TryStatement 即可
                    path.traverse({
                        TryStatement: visitorTryStatement.TryStatement
                    });
                }
                // // 构建try/catch
                // const blocks = blockStatement(body)
                // const tryCatch = tryStatement(
                //   blocks,
                //   catchClause(
                //     identifier('err'),
                //     blockStatement([
                //       expressionStatement(
                //           callExpression(
                //               identifier('console.log'),
                //               [identifier('123')]
                //           )
                //       ),
                //       expressionStatement(
                //         callExpression(
                //             identifier('sentry.captureException'),
                //             [identifier('err')]
                //         )
                //     )
                //     ])
                //   )
                // );
                // path.node.body.body = [tryCatch]
            } })
    };
});

var _a;
var examplePath = path__namespace.resolve(__dirname, './example.js');
console.log(examplePath);
var result = core.transformFileSync(path__namespace.resolve(process.cwd(), 'example.js'), {
    plugins: [[index, {
                outputDir: path__namespace.resolve(__dirname, './output')
            }]]
});
console.log((_a = result === null || result === void 0 ? void 0 : result.code) === null || _a === void 0 ? void 0 : _a.toString());
