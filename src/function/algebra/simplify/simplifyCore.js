import { isAccessorNode, isArrayNode, isConstantNode, isFunctionNode, isIndexNode, isObjectNode, isOperatorNode } from '../../../utils/is.js'
import { createUtil } from './util.js'
import { factory } from '../../../utils/factory.js'

const name = 'simplifyCore'
const dependencies = [
  'equal',
  'isZero',
  'add',
  'subtract',
  'multiply',
  'divide',
  'pow',
  'AccessorNode',
  'ArrayNode',
  'ConstantNode',
  'FunctionNode',
  'IndexNode',
  'ObjectNode',
  'OperatorNode',
  'ParenthesisNode',
  'SymbolNode'
]

export const createSimplifyCore = /* #__PURE__ */ factory(name, dependencies, ({
  equal,
  isZero,
  add,
  subtract,
  multiply,
  divide,
  pow,
  AccessorNode,
  ArrayNode,
  ConstantNode,
  FunctionNode,
  IndexNode,
  ObjectNode,
  OperatorNode,
  ParenthesisNode,
  SymbolNode
}) => {
  const node0 = new ConstantNode(0)
  const node1 = new ConstantNode(1)

  const { hasProperty, isCommutative } =
    createUtil({ FunctionNode, OperatorNode, SymbolNode })
  /**
   * simplifyCore() performs single pass simplification suitable for
   * applications requiring ultimate performance. In contrast, simplify()
   * extends simplifyCore() with additional passes to provide deeper
   * simplification.
   *
   * Syntax:
   *
   *     simplify.simplifyCore(expr)
   *
   * Examples:
   *
   *     const f = math.parse('2 * 1 * x ^ (2 - 1)')
   *     math.simplify.simpifyCore(f)                          // Node {2 * x}
   *     math.simplify('2 * 1 * x ^ (2 - 1)', [math.simplify.simpifyCore]) // Node {2 * x}
   *
   * See also:
   *
   *     derivative
   *
   * @param {Node} node
   *     The expression to be simplified
   * @param {Object} options
   *     Simplification options, as per simplify()
   */
  function simplifyCore (node, options) {
    const context = options ? options.context : undefined
    if (hasProperty(node, 'trivial', context)) {
      // This node does nothing if it has only one argument, so if so,
      // return that argument simplified
      if (isFunctionNode(node) && node.args.length === 1) {
        return simplifyCore(node.args[0], options)
      }
      // For other node types, we try the generic methods
      let simpChild = false
      let childCount = 0
      node.forEach(c => {
        ++childCount
        if (childCount === 1) {
          simpChild = simplifyCore(c, options)
        }
      })
      if (childCount === 1) {
        return simpChild
      }
    }
    if (isOperatorNode(node) && node.isUnary()) {
      const a0 = simplifyCore(node.args[0], options)

      if (node.op === '-') { // unary minus
        if (isOperatorNode(a0)) {
          if (a0.isUnary() && a0.op === '-') {
            return a0.args[0]
          } else if (a0.isBinary() && a0.fn === 'subtract') {
            return new OperatorNode('-', 'subtract', [a0.args[1], a0.args[0]])
          }
        }
        return new OperatorNode(node.op, node.fn, [a0])
      }
    } else if (isOperatorNode(node) && node.isBinary()) {
      const a0 = simplifyCore(node.args[0], options)
      const a1 = simplifyCore(node.args[1], options)

      if (node.op === '+') {
        if (isConstantNode(a0)) {
          if (isZero(a0.value)) {
            return a1
          } else if (isConstantNode(a1)) {
            return new ConstantNode(add(a0.value, a1.value))
          }
        }
        if (isConstantNode(a1) && isZero(a1.value)) {
          return a0
        }
        if (isOperatorNode(a1) && a1.isUnary() && a1.op === '-') {
          return new OperatorNode('-', 'subtract', [a0, a1.args[0]])
        }
        return new OperatorNode(node.op, node.fn, a1 ? [a0, a1] : [a0])
      } else if (node.op === '-') {
        if (isConstantNode(a0) && a1) {
          if (isConstantNode(a1)) {
            return new ConstantNode(subtract(a0.value, a1.value))
          } else if (isZero(a0.value)) {
            return new OperatorNode('-', 'unaryMinus', [a1])
          }
        }
        // if (node.fn === "subtract" && node.args.length === 2) {
        if (node.fn === 'subtract') {
          if (isConstantNode(a1) && isZero(a1.value)) {
            return a0
          }
          if (isOperatorNode(a1) && a1.isUnary() && a1.op === '-') {
            return simplifyCore(
              new OperatorNode('+', 'add', [a0, a1.args[0]]), options)
          }
          return new OperatorNode(node.op, node.fn, [a0, a1])
        }
      } else if (node.op === '*') {
        if (isConstantNode(a0)) {
          if (isZero(a0.value)) {
            return node0
          } else if (equal(a0.value, 1)) {
            return a1
          } else if (isConstantNode(a1)) {
            return new ConstantNode(multiply(a0.value, a1.value))
          }
        }
        if (isConstantNode(a1)) {
          if (isZero(a1.value)) {
            return node0
          } else if (equal(a1.value, 1)) {
            return a0
          } else if (isOperatorNode(a0) && a0.isBinary() &&
                     a0.op === node.op && isCommutative(node, context)) {
            const a00 = a0.args[0]
            if (isConstantNode(a00)) {
              const a00a1 = new ConstantNode(multiply(a00.value, a1.value))
              return new OperatorNode(node.op, node.fn, [a00a1, a0.args[1]], node.implicit) // constants on left
            }
          }
          if (isCommutative(node, context)) {
            return new OperatorNode(node.op, node.fn, [a1, a0], node.implicit) // constants on left
          } else {
            return new OperatorNode(node.op, node.fn, [a0, a1], node.implicit)
          }
        }
        return new OperatorNode(node.op, node.fn, [a0, a1], node.implicit)
      } else if (node.op === '/') {
        if (isConstantNode(a0)) {
          if (isZero(a0.value)) {
            return node0
          } else if (isConstantNode(a1) &&
                      (equal(a1.value, 1) || equal(a1.value, 2) || equal(a1.value, 4))) {
            return new ConstantNode(divide(a0.value, a1.value))
          }
        }
        return new OperatorNode(node.op, node.fn, [a0, a1])
      } else if (node.op === '^') {
        if (isConstantNode(a1)) {
          if (isZero(a1.value)) {
            return node1
          } else if (equal(a1.value, 1)) {
            return a0
          } else {
            if (isConstantNode(a0)) {
              // fold constant
              return new ConstantNode(pow(a0.value, a1.value))
            } else if (isOperatorNode(a0) && a0.isBinary() && a0.op === '^') {
              const a01 = a0.args[1]
              if (isConstantNode(a01)) {
                return new OperatorNode(node.op, node.fn, [
                  a0.args[0],
                  new ConstantNode(multiply(a01.value, a1.value))
                ])
              }
            }
          }
        }
        return new OperatorNode(node.op, node.fn, [a0, a1])
      }
    } else if (isFunctionNode(node)) {
      return new FunctionNode(
        simplifyCore(node.fn), node.args.map(n => simplifyCore(n, options)))
    } else if (isArrayNode(node)) {
      return new ArrayNode(
        node.items.map(n => simplifyCore(n, options)))
    } else if (isAccessorNode(node)) {
      return new AccessorNode(
        simplifyCore(node.object, options), simplifyCore(node.index, options))
    } else if (isIndexNode(node)) {
      return new IndexNode(
        node.dimensions.map(n => simplifyCore(n, options)))
    } else if (isObjectNode(node)) {
      const newProps = {}
      for (const prop in node.properties) {
        newProps[prop] = simplifyCore(node.properties[prop], options)
      }
      return new ObjectNode(newProps)
    } else {
      // cannot simplify
    }
    return node
  }

  return simplifyCore
})
