import { type NodePath } from '@babel/core'
import {
  type TryStatement,
  type AwaitExpression
} from '@babel/types'

interface ProcessedType {
  /** 是否已经处理过 */
  processed?: boolean
}

export type TryStatementNode = NodePath<TryStatement & ProcessedType>

export type AwaitExpressionNode = NodePath<AwaitExpression & ProcessedType>
