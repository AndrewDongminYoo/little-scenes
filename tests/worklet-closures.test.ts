import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const { transform } = require('react-native-worklets/plugin-oxc');

// Raw TS tests keep function hoisting. The actual OXC transform captures values at
// module initialization, so a later-declared dependency becomes undefined on native.
test('OXC worklet factories only capture already initialized local bindings', () => {
  for (const file of [
    'decorations',
    'resources',
    'sprites',
    'strokes',
    'embroidery',
    'rain',
    'text-layout',
    'motion',
    'background',
  ]) {
    const filename = path.resolve(`src/render/${file}.ts`);
    const { code } = transform(fs.readFileSync(filename, 'utf8'), filename, {
      envName: 'production',
    });
    const ast = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true);
    const bindings = new Map<string, number>();
    for (const statement of ast.statements)
      if (ts.isVariableStatement(statement))
        for (const decl of statement.declarationList.declarations)
          if (ts.isIdentifier(decl.name)) bindings.set(decl.name.text, decl.getStart(ast));
    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'default'
      ) {
        for (const arg of node.arguments)
          if (ts.isArrayLiteralExpression(arg))
            for (const dep of arg.elements) {
              if (!ts.isIdentifier(dep) || !bindings.has(dep.text)) continue;
              assert.ok(
                bindings.get(dep.text)! < node.getStart(ast),
                `${file}: worklet captures ${dep.text} before initialization`,
              );
            }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});
