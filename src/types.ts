import { NodePath } from '@babel/core'
import { 
  TryStatement, 
  AwaitExpression,
} from '@babel/types'

type ProcessedType = {
  /** 是否已经处理过 */
  processed?: boolean
}

export type TryStatementNode = NodePath<TryStatement & ProcessedType>

export type AwaitExpressionNode = NodePath<AwaitExpression & ProcessedType>