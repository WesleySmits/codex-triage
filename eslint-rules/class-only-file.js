function declarationOf(statement) {
  if (
    statement.type === 'ExportNamedDeclaration' ||
    statement.type === 'ExportDefaultDeclaration'
  )
    return statement.declaration
  return statement
}

const allowed = new Set([
  'ImportDeclaration',
  'EmptyStatement',
  'ClassDeclaration',
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
])

function inspectStatement(context, statement, foundClass) {
  if (statement.exportKind === 'type') return foundClass
  const declaration = declarationOf(statement)
  if (declaration?.type === 'ClassDeclaration') {
    if (foundClass) context.report({ node: statement, messageId: 'multiple' })
    return true
  }
  if (!declaration || !allowed.has(declaration.type))
    context.report({ node: statement, messageId: 'mixed' })
  return foundClass
}

export const classOnlyFile = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Keep class files limited to one class and type declarations',
    },
    messages: {
      mixed: 'Move runtime declarations outside this class file.',
      multiple: 'Keep only one class in this file.',
    },
    schema: [],
  },
  create(context) {
    return {
      ClassDeclaration(node) {
        const parent = node.parent
        if (parent.type === 'Program') return
        if (
          (parent.type === 'ExportNamedDeclaration' ||
            parent.type === 'ExportDefaultDeclaration') &&
          parent.parent.type === 'Program'
        )
          return
        context.report({ node, messageId: 'mixed' })
      },
      ClassExpression(node) {
        context.report({ node, messageId: 'mixed' })
      },
      Program(node) {
        if (
          !node.body.some(
            (item) => declarationOf(item)?.type === 'ClassDeclaration',
          )
        )
          return
        let foundClass = false
        for (const statement of node.body)
          foundClass = inspectStatement(context, statement, foundClass)
      },
    }
  },
}
