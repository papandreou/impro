# Impro

An image processing engine integrating multiple conversion libraries.

[![NPM version](https://badge.fury.io/js/impro.svg)](http://badge.fury.io/js/impro)
[![Build Status](https://github.com/papandreou/impro/workflows/tests/badge.svg)](https://github.com/papandreou/impro/actions)
[![Coverage Status](https://coveralls.io/repos/papandreou/impro/badge.svg)](https://coveralls.io/r/papandreou/impro)
[![Dependency Status](https://david-dm.org/papandreou/impro.svg)](https://david-dm.org/papandreou/impro)

Impro allows specifying the operations to apply to images and will
select the correct conversion library to perform the job itself.

Support for the following libraries is included:

```
- Gifsicle (npm install gifsicle-stream@^1.0.0)
- GraphicsMagick (npm install gm-papandreou@^1.23.0-patch1)
- Inkscape (npm install inkscape@^3.0.0)
- JpegTran (npm install jpegtran@^2.0.0)
- OptiPNG (npm install optipng@^2.1.0)
- Pngcrush (npm install pngcrush@^2.0.1)
- Pngquant (npm install pngquant@^3.0.0)
- Sharp (npm install sharp@~0.28.0)
- SvgFilter (npm install svgfilter@^4.1.0)
```

> callers must install the libraries and if present they will be enabled

## Introduction

Impro is desgined so that users can express what they want to do to an image
of a given type rather than how to do it. Given a series of tranformations,
the library will select one or more libraries to use to turn the input image
into the desired output and processing is done while fully streaming data.

## Background

Image processing has typically involved command line tools which are often
supplied a set of command line arguments that act as a series of instructions
for the properties of the image being output and anuy transformations to apply.
Each of these options is modelled as an "operation".

### Operations

An operation is a named constraint (property or transformation) that an
_output image_ must conform to after it is applied.

### Engines

An engine is a representation a particular image library that supports a
certain set of operations on images of certain types.

### Pipelines

A pipeline is a programmed series operations that will be executed by
one or more engines to turn an image from the input to the desired output.

## Use

The `impro` library can be installed simply from npm:

```
npm install impro
```

The standard configuration of impro is an instance that is configured with
support for all supported engines - but the presence of the image libraries
is detected which means they must be installed alongside. Each library has
a node module of the same name (with the exception of gm as noted above):

```
npm install sharp
npm install gifsicle
```

> some of the libraries may have requirements on native packages
> that must be installed via an operating system package manager

## Constructing image processing pipelines

By default an import of impro returns an object with all registered engines
that is ready to start handling conversion operations. To do this, we create
a pipeline which we instruct about what it will do to an image.

The prepared pipeline is a Duplex stream that is ready to have the input image
data piped to it and will stream the output image data out of itself:

```js
const impro = require('impro');

const pipeline = impro.createPipeline({ type: 'png' }).jpeg();
```

For example, the pipeline above expect to recieve a PNG input image and
will convert it to a JPEG using the _chaining API_.

### Chaining API

The pipeline exposes methods for each operation that can be supported on a
method. Above, the `.jpeg()` is a conversion operation to the JPEG type.

Let's look at another example:

```js
impro
  .createPipeline({ type: 'png' })
  .grayscale()
  .resize(100, 100)
  .jpeg()
  .progressive();
```

This will accept a PNG, convert it to a grayscale image, resize it and finally
output it as a JPEG that is interlaced. The chaining API is intended as the
standard end-user interface that exposes the full power of the library in a
simple and transparent fashion.

### Low-level API

For cases where impro is used as a library another API is exposed which is
also used internally and underlies chaining methods: an operations list.

Each named operation is itself a small object containing a name and array
of the arguments (zero or more) that are provided to it. These operations
are placed in an array and can be passed directly when creating a pipeline:

```js
const pipeline = impro.createPipeline({ type: 'png' }, [
  { name: 'grayscale', args: [] },
  { name: 'resize', args: [100, 100] },
  { name: 'jpeg', args: [] },
  { name: 'progressive', args: [] },
]);
```

The pipeline above is equivalent to the chaining API example.

## License

Impro is licensed under a standard 3-clause BSD license.
