var menubar = require('menubar')
var storage = require('electron-json-storage');

var mb = menubar();

mb.setOption('width', 320);
mb.setOption('heigth', 320);
mb.setOption('minWidth', 320);
mb.setOption('minHeight', 320);
mb.setOption('maxWidth', 320);
mb.setOption('maxHeight', 320);
mb.setOption('resizeable', false);
