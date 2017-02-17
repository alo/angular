/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */


import {ɵViewType as ViewType} from '@angular/core';

import {CompileTokenMetadata} from '../compile_metadata';
import {createDiTokenExpression} from '../compiler_util/identifier_util';
import * as o from '../output/output_ast';

import {CompileView} from './compile_view';

export function getPropertyInView(
    property: o.Expression, callingView: CompileView, definedView: CompileView): o.Expression {
  if (callingView === definedView) {
    return property;
  } else {
    let viewProp: o.Expression = o.THIS_EXPR;
    let currView: CompileView = callingView;
    while (currView !== definedView && currView.declarationElement.view) {
      currView = currView.declarationElement.view;
      viewProp = viewProp.prop('parentView');
    }
    if (currView !== definedView) {
      throw new Error(
          `Internal error: Could not calculate a property in a parent view: ${property}`);
    }
    return property.visitExpression(new _ReplaceViewTransformer(viewProp, definedView), null);
  }
}

class _ReplaceViewTransformer extends o.ExpressionTransformer {
  constructor(private _viewExpr: o.Expression, private _view: CompileView) { super(); }
  private _isThis(expr: o.Expression): boolean {
    return expr instanceof o.ReadVarExpr && expr.builtin === o.BuiltinVar.This;
  }

  visitReadVarExpr(ast: o.ReadVarExpr, context: any): any {
    return this._isThis(ast) ? this._viewExpr : ast;
  }
  visitReadPropExpr(ast: o.ReadPropExpr, context: any): any {
    if (this._isThis(ast.receiver)) {
      // Note: Don't cast for members of the AppView base class...
      if (this._view.fields.some((field) => field.name == ast.name) ||
          this._view.getters.some((field) => field.name == ast.name)) {
        return this._viewExpr.cast(this._view.classType).prop(ast.name);
      }
    }
    return super.visitReadPropExpr(ast, context);
  }
}

export function injectFromViewParentInjector(
    view: CompileView, token: CompileTokenMetadata, optional: boolean): o.Expression {
  let viewExpr: o.Expression;
  if (view.viewType === ViewType.HOST) {
    viewExpr = o.THIS_EXPR;
  } else {
    viewExpr = o.THIS_EXPR.prop('parentView');
  }
  const args = [createDiTokenExpression(token), o.THIS_EXPR.prop('parentIndex')];
  if (optional) {
    args.push(o.NULL_EXPR);
  }
  return viewExpr.callMethod('injectorGet', args);
}

export function getHandleEventMethodName(elementIndex: number): string {
  return `handleEvent_${elementIndex}`;
}
