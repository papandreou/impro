# Module Kickstart

An example of how you can set up a repo for a node module enabling use of babel
while allowing you to publish only transpiled code. It works when linking the
source repo into other projects (by adding the babel runtime transpiler) and
will automatically build the files for distribution when you publish packages.

## Notes

### Enable source maps

When transpiling the code with babel we enable inline source maps. The module
[source-map-support](https://github.com/evanw/node-source-map-support) adds
support for source maps in node. The module should be installed in the consuming
project.

### babel-plugin-add-module-exports

This
[babel plugin](https://www.npmjs.com/package/babel-plugin-add-module-exports)
will allow you to write `ES?` module code that works nicely with CommonJS.

Take this example:

```js
export default function main() { /* ... */ }
```

It would normally be transpiled into something rougly equivalent to:

```js
module.exports = {
  default: function main() { /* ... */ }
};
```

With this plugin it will be transpiled into:

```js
module.exports = function main() { /* ... */ };
```

It will only do that change, when you have only one `export` which is also
marked with `default`. It will not change the behaviour in other cases.
