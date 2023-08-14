"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helper_plugin_utils_1 = require("@babel/helper-plugin-utils");
exports.default = (0, helper_plugin_utils_1.declare)((api, options) => {
    return {
        pre(file) {
            this.set('imported', []);
        },
        visitor: {
            Program: {
                enter(path, state) {
                    let imported = false;
                    /** 如果没有找到lodash 那么就导入他 */
                    path.traverse({
                        ImportDeclaration(importNodePath) {
                            const importNode = importNodePath.node;
                            const importSource = importNode.source;
                            if (importSource.value === 'lodash' || importSource.value === 'sentry') {
                                imported = true;
                            }
                        }
                    });
                    if (!imported) {
                        /** https://babeljs.io/docs/babel-template#templatestatement */
                        path.node.body.unshift(
                        // api.template.statement(`import lodash from 'lodash'`)()
                        api.template.statement(`import * as sentry from 'sentry'`)());
                    }
                }
            },
            TryStatement(path, state) {
                if (path.node.processed) {
                    return path.skip();
                }
                /** 需要给try/catch 里面的东西进行上报 */
                path.traverse({
                    CatchClause(catchNodePath) {
                        const catchNode = catchNodePath.node;
                        const catchBody = catchNode.body;
                        path.node.processed = true;
                        /** 如果catch 中已经包含了 sentry.captureException 那么就不需要添加 */
                        const hasSentryCaptureException = catchBody.body.some((node) => {
                            return node.type === 'ExpressionStatement'
                                && node.expression.type === 'CallExpression'
                                && node.expression.callee.type === 'MemberExpression'
                                && node.expression.callee.object?.name === 'sentry'
                                && node.expression.callee.property?.name === 'captureException';
                        });
                        if (hasSentryCaptureException) {
                            return;
                        }
                        const param = catchNode.param;
                        /**
                         * 如果没有参数 那么就不需要添加
                         * try {
                         *   const data = await sleep()
                         * } catch {
                         *   console.log(123)
                         * }
                         */
                        if (param === null || !param?.name) {
                            return;
                        }
                        /**
                         * 如果catch body 里面有内容 那么就需要进行上报
                         * TODO: error 有可能是一个变量，所以需要判断一下
                         */
                        catchBody.body.unshift(api.template.statement(`sentry.captureException(${param.name})`)());
                    }
                });
            },
            /**
             * 处理 await 后面跟着的catch
             * const data = await sleep().catch(() => {})
             */
            AwaitExpression(path, state) {
                const node = path.node;
                const argument = node.argument;
                const t = api.types;
                if (path.node.processed) {
                    return path.skip();
                }
                if (t.isCallExpression(argument) && argument.callee?.property?.name !== 'catch') {
                    const catchIdentifier = t.identifier('catch');
                    const errorFunc = t.arrowFunctionExpression([t.identifier('error')], t.blockStatement([
                        t.expressionStatement(t.callExpression(t.memberExpression(t.identifier('console'), t.identifier('error')), [t.identifier('error')]))
                    ]));
                    const catchExpression = t.callExpression(t.memberExpression(argument, catchIdentifier), [errorFunc]);
                    path.replaceWith(t.awaitExpression(catchExpression));
                    return path.skip();
                }
                if (argument.callee.type !== 'MemberExpression' || argument.callee.property.name !== 'catch') {
                    return;
                }
                const args = argument.arguments;
                if (args.length === 0) {
                    return;
                }
                /** catch 回调函数 */
                const catchCallback = args[0];
                if (!catchCallback.body && catchCallback.body.length === 0) {
                    return;
                }
                let params = catchCallback.params;
                path.node.processed = true;
                /** 如果没有参数,  */
                if (params.length === 0) {
                    catchCallback.params = [api.types.identifier('error')];
                }
                const paramsName = catchCallback.params[0].name;
                const callbackBody = catchCallback.body.body;
                const hasSentryCaptureException = callbackBody.some((node) => {
                    return node.type === 'ExpressionStatement' && node.expression.callee.object.name === 'sentry';
                });
                if (hasSentryCaptureException) {
                    return;
                }
                /**TODO: 如果有加入sentry，那么就不处理 */
                // api.types.memberExpression(
                //   api.types.identifier('sentry'),
                //   api.types.identifier('captureException')
                // );
                const element = api.types.callExpression(api.types.identifier('sentry.captureException'), [api.types.identifier(paramsName)]);
                catchCallback.body.body.unshift(element);
            },
            FunctionDeclaration(path, state) {
                const isAsync = path.node.async;
                /**
                 * 如果不是 async/await 函数 那么就跳过
                 */
                if (!isAsync) {
                    /** 跳过当前节点 以及它的子节点 */
                    return path.skip();
                }
                const { body } = path.node.body;
                const hasTryCatch = body.some((node) => {
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
                        TryStatement(path, state) {
                            /** 需要给try/catch 里面的东西进行上报 */
                            path.traverse({
                                CatchClause(catchNodePath) {
                                    const catchNode = catchNodePath.node;
                                    const catchBody = catchNode.body;
                                    /** 如果catch 中已经包含了 sentry.captureException 那么就不需要添加 */
                                    const hasSentryCaptureException = catchBody.body.some((node) => {
                                        return node.type === 'ExpressionStatement'
                                            && node.expression.type === 'CallExpression'
                                            && node.expression.callee.type === 'MemberExpression'
                                            && node.expression.callee.object?.name === 'sentry'
                                            && node.expression.callee.property?.name === 'captureException';
                                    });
                                    if (hasSentryCaptureException) {
                                        return;
                                    }
                                    const param = catchNode.param;
                                    /**
                                     * 如果没有参数 那么就不需要添加
                                     * try {
                                     *   const data = await sleep()
                                     * } catch {
                                     *   console.log(123)
                                     * }
                                     */
                                    if (param === null || !param?.name) {
                                        return;
                                    }
                                    path.node.processed = true;
                                    /**
                                     * 如果catch body 里面有内容 那么就需要进行上报
                                     * TODO: error 有可能是一个变量，所以需要判断一下
                                     */
                                    catchBody.body.unshift(api.template.statement(`sentry.captureException(${param.name})`)());
                                }
                            });
                        },
                    });
                    return;
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
            }
        }
    };
});
//# sourceMappingURL=babel-plugin-sentry-auto-report.js.map