import { type BabelFile } from '@babel/core'
import { type BabelAPI, declare } from '@babel/helper-plugin-utils'
import {
  type FunctionExpression,
  type MemberExpression,
  type Identifier,
  type CallExpression
} from '@babel/types'
import { type AwaitExpressionNode, type TryStatementNode } from './types'
import template from '@babel/template'

const visitorTryStatement = {
  TryStatement (path: TryStatementNode) {
    if (path.node.processed) {
      path.skip()
      return
    }
    /** 需要给try/catch 里面的东西进行上报 */
    path.traverse({
      CatchClause (catchNodePath) {
        const catchNode = catchNodePath.node
        const catchBody = catchNode.body
        path.node.processed = true
        /** 如果catch 中已经包含了 sentry.captureException 那么就不需要添加 */
        const hasSentryCaptureException = catchBody.body.some((node) => {
          return node.type === 'ExpressionStatement' &&
            node.expression.type === 'CallExpression' &&

            node.expression.callee.type === 'MemberExpression' &&
            (node.expression.callee.object as any)?.name === 'sentry' &&
            (node.expression.callee.property as any)?.name === 'captureException'
        })

        if (hasSentryCaptureException) {
          return
        }

        const param = catchNode.param

        /**
         * 如果没有参数 那么就不需要添加
         * try {
         *   const data = await sleep()
         * } catch {
         *   console.log(123)
         * }
         */
        if (param === null || !(param as any)?.name) {
          return
        }

        /**
         * 如果catch body 里面有内容 那么就需要进行上报
         */
        catchBody.body.unshift(
          template.statement(`sentry.captureException(${(param as any).name})`)()
        )
      }
    })
  }
}

export default declare((api: BabelAPI, options: any) => {
  return {
    name: 'sentry-auto-report',
    pre (this, file: BabelFile) {
      this.set('imported', [])
    },
    visitor: {
      Program: {
        enter (path, state) {
          let imported = false
          /** 如果没有找到sentry 那么就导入他 */
          path.traverse({
            ImportDeclaration (importNodePath) {
              const importNode = importNodePath.node
              const importSource = importNode.source

              if (importSource.value === 'sentry') {
                imported = true
              }
            }
          })

          if (!imported) {
            /** https://babeljs.io/docs/babel-template#templatestatement */
            path.node.body.unshift(
              api.template.statement('import * as sentry from \'sentry\'')()
            )
          }
        }
      },
      ...visitorTryStatement,
      /**
       * 处理 await 后面跟着的catch
       * const data = await sleep().catch(() => {})
       */
      AwaitExpression (path: AwaitExpressionNode, state) {
        const node = path.node
        const argument = node.argument
        const t = api.types

        if ((path.node).processed) {
          path.skip(); return
        }

        if (t.isCallExpression(argument) && ((argument.callee as MemberExpression)?.property as Identifier)?.name !== 'catch') {
          const catchIdentifier = t.identifier('catch')
          const errorFunc = t.arrowFunctionExpression(
            [t.identifier('error')],
            t.blockStatement([
              t.expressionStatement(
                t.callExpression(
                  t.memberExpression(t.identifier('sentry'), t.identifier('captureException')),
                  [t.identifier('error')]
                )
              )
            ])
          )
          const catchExpression = t.callExpression(
            t.memberExpression(argument, catchIdentifier),
            [errorFunc]
          )
          path.replaceWith(t.awaitExpression(catchExpression))
          path.skip(); return
        }

        if (
          t.isCallExpression(argument) &&
          (
            ((argument)?.callee).type !== 'MemberExpression' ||
            (((argument).callee)?.property as Identifier).name !== 'catch')
        ) {
          return
        }

        const args = (argument as CallExpression).arguments
        if (args.length === 0) {
          return
        }
        /** catch 回调函数 */
        const catchCallback: FunctionExpression = args[0] as unknown as FunctionExpression

        if (!catchCallback.body) {
          return
        }

        const params = catchCallback.params
        path.node.processed = true

        /** 如果没有参数,  */
        if (params.length === 0) {
          catchCallback.params = [api.types.identifier('error')]
        }

        const paramsName = (catchCallback.params?.[0] as Identifier)?.name

        const callbackBody = catchCallback.body.body

        const hasSentryCaptureException = callbackBody.some((node) => {
          return node.type === 'ExpressionStatement' && (((node.expression as CallExpression).callee as MemberExpression).object as Identifier).name === 'sentry'
        })
        /** 如果有加入sentry，那么就不处理 */
        if (hasSentryCaptureException) {
          return
        }

        const element = api.types.callExpression(api.types.identifier('sentry.captureException'), [api.types.identifier(paramsName)]);

        (catchCallback as any).body.body.unshift(
          element
        )
      },
      FunctionDeclaration (path, state) {
        const isAsync = path.node.async

        /**
         * 如果不是 async/await 函数 那么就跳过
         */
        if (!isAsync) {
          /** 跳过当前节点 以及它的子节点 */
          path.skip(); return
        }

        const { body } = path.node.body
        const hasTryCatch = body.some((node) => {
          return node.type === 'TryStatement'
        })

        // /**
        //  * 首先先判断它是否含有try catch 语句 或者所有有catch语句
        //  * 如果有的话 那么就不需要再次添加，然后直接添加 sentry.captureException
        //  * 如果没有的话 那么就需要添加
        //  */

        if (hasTryCatch) {
          // 如果有try catch 那么直接使用上面的TryStatement 即可
          path.traverse({
            TryStatement: visitorTryStatement.TryStatement
          })
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
  }
})
