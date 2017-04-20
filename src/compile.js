'use strict';

// TODO: убрать typename, когда не нужно
// TODO: добавить template, когда нужно (template f<x>)
// TODO: развести typename/template, когда не компилируется
// TODO: добавить числа как параметры шаблонов
// TODO: Добавить вариадические шаблоны?

if(process.argv.length !== 3) {
  console.error('Usage: node ' + process.argv[1] + '<source>');
  process.exit(1);
}

var peg = require("pegjs");
var fs = require("fs");
var util = require("util");

var parser = peg.generate(String(fs.readFileSync(__dirname + '/tpllang.peg')));

if(parser.lang != null) throw new Error('parser.lang is defined');
parser.lang = require('./lang');

console.log(parser.parse(String(fs.readFileSync(process.argv[2]))).compile());