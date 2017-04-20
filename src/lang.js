'use strict';

module.exports = {
  Code: Code,
  Namespace: Namespace,
  Statements: Statements,
  Identifier: Identifier,
  Value: Value,
  Assignment: Assignment,
  TypedArgument: TypedArgument,
  Typedef: Typedef,
  Type: Type,
  TypeTuple: TypeTuple,
  TypeFunc: TypeFunc,
  Func: Func,
  Lambda: Lambda,
  FuncCall: FuncCall,
  ImpureCall: ImpureCall,
  ImpureDefinition: ImpureDefinition,
  Field: Field,
  Dereference: Dereference,
  
  createDefaultContext: createDefaultContext
};

function assert(x) {
  console.assert(x);
}

function createDefaultContext() {
  return {
    TAB: '  ',
    NEWLINE: '\n',
    FUNC_RESULT_NAME: '_value',
    DUP_ARG_PREFIX: '_arg',
    types: {
      'val': new Identifier('typename')
    },
    indent: '',
    indents: [],
    indentPush: function() {
      this.indents.push(this.indent);
      this.indent += this.TAB;
    },
    indentPushNew: function(indent) {
      this.indents.push(this.indent);
      this.indent = indent;
    },
    indentPop: function() {
      assert(this.indents.length);
      this.indent = this.indents.pop();
    },
    
    locals: {},
    refreshLocalsInfo: function() {
      this.locals = {};
    },
    pushLocal: function(name) {
      if(!(name in this.locals)) {
        this.locals[name] = [name];
        return;
      }
      
      var names = this.locals[name];
      if(!names.length) {
        names.push(name);
        return;
      }
      
      names.push(this.DUP_ARG_PREFIX + names.length + '_' + name);
    },
    popLocal: function(name) {
      assert(name in this.locals);
      var names = this.locals[name];
      assert(names.length);
      names.pop();
    },
    uniqueName: function(name) {
      if(!(name in this.locals)) return name;
      
      var names = this.locals[name];
      if(!names.length) return name;
      
      return names[names.length - 1];
    }
  };
}

function listToCpp(list, ctx, prefix, elementIndent, delimiter, postfix) {
  function toCpp(element) {
    return element.toCpp(ctx);
  }
  ctx.indentPushNew(elementIndent);
  var translated = prefix + list.map(toCpp).join(delimiter) + postfix;
  ctx.indentPop();
  return translated;
}

function instance(Parent, Class) {
  Class.prototype = Object.create(Parent.prototype);
  Class.prototype.constructor = Class;
}

function LangEntity() {}

LangEntity.prototype.compile = function(ctx) {
  ctx = ctx || createDefaultContext();
  ctx.refreshLocalsInfo();
  this.prepareArgs(ctx);
  return this.toCpp(ctx);
};

LangEntity.prototype.toCpp = function(ctx) {
  throw new Error('"toCpp" is not implemented');
};

LangEntity.prototype.prepareArgs = function(ctx) {
  if(this.children) {
    this.children.forEach(function(child) {
      child.prepareArgs(ctx);
    });
  }
};

function Code(code, inline) {
  assert(typeof code === 'string');
  this.code = code;
  this.inline = Boolean(inline);
}

instance(LangEntity, Code);

Code.prototype.toCpp = function(ctx) {
  if(this.inline) return this.code;
  
  var prefix = new RegExp('^\\s{' + /^[\r\n]*(\s*)/.exec(this.code)[1].length + '}');
  var lines = this.code.trim().split(/\r?\n|\r/)
    .map(function(line) { return line.replace(prefix, ''); });
  return ctx.indent + lines.join(ctx.NEWLINE + ctx.indent) + ctx.NEWLINE;
};

function Namespace(name, children) {
  assert(typeof name === 'string');
  this.name = name;
  this.children = children || [];
}

instance(LangEntity, Namespace);

Namespace.prototype.toCpp = function(ctx) {
  return listToCpp(this.children, ctx,
    ctx.indent + 'namespace ' + this.name + ' {' + ctx.NEWLINE,
    ctx.indent + ctx.TAB,
    '',
    '} // end of namespace ' + this.name + ctx.NEWLINE);
};

function Statements(statements) {
  this.children = statements;
}

instance(LangEntity, Statements);

Statements.prototype.toCpp = function(ctx) {
  return listToCpp(this.children, ctx, '', ctx.indent, '', '');
};

function Identifier(name) {
  assert(typeof name === 'string');
  this.name = name;
}

instance(LangEntity, Identifier);

Identifier.prototype.toString = function() {
  return this.name;
};

Identifier.prototype.prepareArgs = function(ctx) {
  this.name = ctx.uniqueName(this.name);
};

Identifier.prototype.toCpp = function(ctx) {
  return this.name;
};

function Value(name, children) {
  assert(typeof name === 'string');
  this.name = name;
  this.children = children;
}

instance(LangEntity, Value);

Value.prototype.childrenToCpp = function(ctx) {
  if(!this.children) return '';
  if(!this.children.length) return ' {}';
  
  var that = this;
  if(this.children.some(function(child) {
    return child.name == that.name;
  })) {
    throw new Error('C++ forbids nested identifiers: ' + that.name);
  }
  
  return listToCpp(this.children, ctx, ' {' + ctx.NEWLINE, ctx.indent + ctx.TAB, '', ctx.indent + '}');
};

Value.prototype.toCpp = function(ctx) {
  return ctx.indent + 'struct ' + this.name + this.childrenToCpp(ctx) + ';' + ctx.NEWLINE;
};

function Assignment(name, value) {
  assert(typeof name === 'string');
  this.name = name;
  this.value = value;
}

instance(LangEntity, Assignment);

Assignment.prototype.toCpp = function(ctx) {
  return ctx.indent + 'typedef ' + this.value.toCpp(ctx) + ' ' + this.name + ';' + ctx.NEWLINE;
};

Assignment.prototype.prepareArgs = function(ctx) {
  this.value.prepareArgs(ctx);
};

function TypedArgument(name, type) {
  assert(typeof name === 'string');
  this.name = name;
  this.type = type;
}

instance(LangEntity, TypedArgument);

TypedArgument.prototype.toCpp = function(ctx) {
  return this.type.toCpp(ctx) + ' ' + this.name;
};

TypedArgument.prototype.prepareArgs = function(ctx) {
  this.name = ctx.uniqueName(this.name);
};

function Typedef(name, value) {
  assert(typeof name === 'string');
  this.name = name;
  this.value = value;
}

instance(LangEntity, Typedef);

Typedef.prototype.toCpp = function(ctx) {
  if(this.name in ctx.types)
    throw new Error('Type redefinition: ' + this.name + '.');
  
  // TODO: compile or not compile?
  ctx.types[this.name] = this.value;
  
  return '';
};

Typedef.prototype.prepareArgs = function(ctx) {
  this.value.prepareArgs(ctx);
};

function Type(name) {
  assert(typeof name === 'string');
  this.name = name;
}

instance(LangEntity, Type);

Type.prototype.toCpp = function(ctx) {
  if (!(this.name in ctx.types))
    throw new Error('Unknown type ' + this.name + '.');
  
  return ctx.types[this.name].toCpp(ctx);
};

function TypeTuple(types) {
  this.types = types;
}

instance(LangEntity, TypeTuple);

TypeTuple.prototype.toCpp = function(ctx) {
  return listToCpp(this.types, ctx, '', '', ', ', '');
};

function TypeFunc(type1, type2) {
  this.type1 = type1;
  this.type2 = type2;
}

instance(LangEntity, TypeFunc);

TypeFunc.prototype.toCpp = function(ctx) {
  var t1 = this.type1.toCpp(ctx, '');
  var t2 = this.type2.toCpp(ctx, '');
  
  if(t2 != 'typename')
    throw new Error('Function type must be * -> val.');
  
  return 'template <' + t1 + '> class';
};

function Func(name, args, value, children) {
  assert(typeof name === 'string');
  if(value instanceof Lambda) {
    throw new Error('C++ forbids nested lambdas.');
  }
  this.name = name;
  this.args = args || [];
  this.value = value;
  this.children_ = children;
  
  this.children = null;
};

instance(LangEntity, Func);

Func.prototype.childrenToCpp = Value.prototype.childrenToCpp;

Func.prototype.prepareChildren = function(ctx) {
  if(!this.children) {
    var children = this.children_ || [];
    if(this.value) {
      if(this.value instanceof Lambda) {
        this.children = children.concat([this.value]);
      } else {
        this.children = children.concat([new Assignment(ctx.FUNC_RESULT_NAME, this.value)]);
      }
    } else {
      this.children = this.children_;
    }
  }
};

Func.prototype.toCpp = function(ctx) {
  var args = '', appliedArgs = '';

  this.prepareChildren(ctx);
  
  if(this.args.length) {
    function isActual(arg) {
      return arg instanceof TypedArgument;
    }
    function processApplied(arg) {
      if(arg instanceof TypedArgument)
        return new Identifier(arg.name);
      return arg;
    }
    var actual = this.args.filter(isActual);
    args = listToCpp(actual, ctx, ctx.indent + 'template <', '', ', ', '>' + ctx.NEWLINE);
    
    if(actual.length < this.args.length) {
      var applied = this.args.map(processApplied);
      appliedArgs = listToCpp(applied, ctx, '<', '', ', ', '>');
    }
  }
  
  return args + ctx.indent + 'struct ' + this.name + appliedArgs + this.childrenToCpp(ctx) + ';' + ctx.NEWLINE;
};

Func.prototype.prepareArgs = function(ctx) {
  function isActual(arg) {
    return arg instanceof TypedArgument;
  }
  
  function name(arg) {
    return arg.name;
  }
  
  var argNames = this.args.filter(isActual).map(name);
  argNames.forEach(function(name) { ctx.pushLocal(name); });
  
  this.args.forEach(function(arg) { arg.prepareArgs(ctx); });
  if(this.value) this.value.prepareArgs(ctx);
  if(this.children_) this.children_.forEach(function(child){ child.prepareArgs(ctx); });
  
  argNames.forEach(function(name) { ctx.popLocal(name); });
};

function Lambda(args, value, children) {
  if(value instanceof Lambda) {
    throw new Error('C++ forbids nested lambdas.');
  }
  Func.call(this, '', args, value, children);
}

instance(Func, Lambda);

Lambda.prototype.setName = function(name) {
  this.name = name;
};

Lambda.prototype.Func_toCpp = Func.prototype.toCpp;

Lambda.prototype.toCpp = function(ctx) {
  if(!this.name) {
    this.name = ctx.FUNC_RESULT_NAME;
  }
  return this.Func_toCpp(ctx);
};

function FuncCall(expr, args, escape) {
  this.expr = expr;
  this.args = args || [];
  this.escape = Boolean(escape);
}

instance(LangEntity, FuncCall);

FuncCall.prototype.toCpp = function(ctx) {
  var args = '', prefix = '';
  
  if(this.args.length) {
    args = listToCpp(this.args, ctx, ' <', '', ', ', '> ');
  }

  if(!this.escape) {
    args += '::' + ctx.FUNC_RESULT_NAME;
    prefix = 'typename ';
  }
  
  return prefix + this.expr.toCpp(ctx, '') + args;
};

FuncCall.prototype.prepareArgs = function(ctx) {
  this.expr.prepareArgs(ctx);
  this.args.forEach(function(arg){ arg.prepareArgs(ctx); });
};

function ImpureDefinition(children) {
  this.children = children || [];
}

instance(LangEntity, ImpureDefinition);

ImpureDefinition.prototype.toCpp = function(ctx) {
  return new Code(listToCpp(this.children, ctx, '', '', '', '')).toCpp(ctx);
};

function ImpureCall(name, args) {
  this.name = name;
  this.args = args || [];
}

instance(LangEntity, ImpureCall);

ImpureCall.prototype.toCpp = function(ctx) {
  var args = '';
  
  if(this.args.length) {
    args = listToCpp(this.args, ctx, ' <', '', ', ', '> ');
  }

  return ctx.indent + this.name + args + '()';
};

ImpureCall.prototype.prepareArgs = function(ctx) {
  this.name = ctx.uniqueName(this.name);
  this.args.forEach(function(arg){ return arg.prepareArgs(ctx); });
}

function Field(expr, fieldName) {
  this.expr = expr;
  this.fieldName = fieldName;
}

instance(LangEntity, Field);

Field.prototype.toCpp = function(ctx) {
  return 'typename ' + this.expr.toCpp(ctx, '') + '::' + this.fieldName;
};

Field.prototype.prepareArgs = function(ctx) {
  this.expr.prepareArgs(ctx);
  this.fieldName = ctx.uniqueName(this.fieldName);
};

function Dereference(expr) {
  this.expr = expr;
}

instance(LangEntity, Dereference);

Dereference.prototype.toCpp = function(ctx) {
  return 'typename ' + this.expr.toCpp(ctx, '') + '::' + ctx.FUNC_RESULT_NAME;
};

Dereference.prototype.prepareArgs = function(ctx) {
  this.expr.prepareArgs(ctx);
};
