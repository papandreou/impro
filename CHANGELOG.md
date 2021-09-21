### v0.11.0 (2021-09-21)

- [#5](https://github.com/papandreou/impro/pull/5) Added support for configuring 'failOnError' for Sharp engine ([Priyank Parashar](mailto:paras20xx@gmail.com))

### v0.10.0 (2021-05-12)

- [Update the supported list of libraries with versions.](https://github.com/papandreou/impro/commit/a685fe5162a94496adcc53956b95c5cda262175a) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Bump svgfilter to 4.1.0.](https://github.com/papandreou/impro/commit/a664793ddd38d2141a73ba7d6e42fffd7141d181) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Statically define exports in the engines index file.](https://github.com/papandreou/impro/commit/2fb6b001f142342818a3d4ef69babbd5879fdcaa) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Bump memoizesync to 1.1.1 and set caret version.](https://github.com/papandreou/impro/commit/7c09e7cde3b9aed7d0b0a0f8bc5d3b37bd93ff13) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Bump jpegtran to 2.0.0.](https://github.com/papandreou/impro/commit/e625663633de21d41b5eed14d141c425bfaeac4e) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [+21 more](https://github.com/papandreou/impro/compare/v0.9.0...v0.10.0)

### v0.9.0 (2021-01-20)

- [Bump timeout in an attempt to fix CI.](https://github.com/papandreou/impro/commit/e8076bbca73ae3be34b21e35802160f92b319b41) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Amend test warmup code for on macOS so no UI opens with inkscape v1+.](https://github.com/papandreou/impro/commit/7648b6c1cc82a18d7943b5af1e7993993f49f321) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Differentiate between test files and utility code after 7321c59.](https://github.com/papandreou/impro/commit/babe47de22133d0546f8860d471209c3ef12fca3) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Switch to GitHub Actions](https://github.com/papandreou/impro/commit/6aeac2580e4f0ebb51fb8d46ac96056581d94189) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Support avif](https://github.com/papandreou/impro/commit/90e47f64df8a0cc95e6acc2686a835aa3ed0071f) ([Andreas Lind](mailto:andreaslindpetersen@gmail.com))
- [+14 more](https://github.com/papandreou/impro/compare/v0.8.0...v0.9.0)

### v0.8.0 (2020-09-04)

- [Use the version hook to generate a changelog.](https://github.com/papandreou/impro/commit/73dabb8a00344f8ca0ced4016a3fd5dbd1bb945f) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Upgrade to sharp 0.26.0.](https://github.com/papandreou/impro/commit/bece84fa3ec6205661fae41414d65a1835a5717e) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Use a pckage repository to install inkscape 1.0 on CI.](https://github.com/papandreou/impro/commit/90d7970513087433f66cd33ccf30facad9ef1d29) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Switch CI to the bionic after 0ce498c.](https://github.com/papandreou/impro/commit/3337f55c659771ca69781fb9afeecc4ee524a54f) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Drop node 8 support](https://github.com/papandreou/impro/commit/8a79b49ad547dc4f4a7d4982824b5ea2b8b4854e) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [+1 more](https://github.com/papandreou/impro/compare/v0.7.2...v0.8.0)

### v0.7.2 (2020-08-30)

- [Repair package installation on CI.](https://github.com/papandreou/impro/commit/19378af5ab5b56794650e91311c1931ddc265ef6) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Add trim operation in operation list of sharp engine](https://github.com/papandreou/impro/commit/af2aa36beb8c26317b7c9007dc22b68776f81896) ([Donghoon Song](mailto:thdehdgns@gmail.com))

### v0.7.1 (2020-05-21)

- [#3](https://github.com/papandreou/impro/pull/3) Add ncolors argument and use it for a legacy query string engine arg. ([Alex J Burke](mailto:alex@alexjeffburke.com))

### v0.7.0 (2020-04-09)

- [Tighten an error message.](https://github.com/papandreou/impro/commit/de3503b01f82bafa21edbe4e772052f81f1737c0) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Change the argument order so the query string comes first.](https://github.com/papandreou/impro/commit/c0e050843e0d3b9ed42c94f84d0f11a6ea99c63e) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Bring in the legacy query string parsing as a queryString function.](https://github.com/papandreou/impro/commit/8b445555249bbf8134a595cbae4c037bb92bd8da) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Expose query string parsing as a function on a top-level namespace.](https://github.com/papandreou/impro/commit/56cc875e4b4dba39bac4b64ef4cf3d068817fd59) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Remove string args to createPipeline\(\) being parsed to operations.](https://github.com/papandreou/impro/commit/fdce94324c678d176469390c5c788bf3f3c4832a) ([Alex J Burke](mailto:alex@alexjeffburke.com))

### v0.6.1 (2020-02-18)

- [Tighten optipng "o" operation argument checking and add extra tests.](https://github.com/papandreou/impro/commit/2e8505eb88f9496e6c32aff3cdf74fc4a7a13cd3) ([Alex J Burke](mailto:alex@alexjeffburke.com))

### v0.6.0 (2020-02-16)

- [Add .npmrc to disable package-lock](https://github.com/papandreou/impro/commit/807ed5011d8da7b72e5818b187aa56adf852488f) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Allow -noreduce argument to pngcrush engine.](https://github.com/papandreou/impro/commit/16f863875cf6697a75ab1bdc861cbc3bdf84ef1f) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Implement an addStream\(\) method to be used with arbitrary streams.](https://github.com/papandreou/impro/commit/ab9572884980e03b68c9fcd3e285c1e5362e2456) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Also attach a "root" property when calling into SvgFilter.](https://github.com/papandreou/impro/commit/a51c0ca122780a3d6342db9898689cc04a6af7e7) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Have the parse\(\) method return the consumed fragments.](https://github.com/papandreou/impro/commit/b76c52331426b5308b7e10c61a1c4bb4bfce8881) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [+1 more](https://github.com/papandreou/impro/compare/v0.5.1...v0.6.0)

### v0.5.1 (2019-11-23)

- [Do not access the gm library prototype if it is unavailable.](https://github.com/papandreou/impro/commit/dfe5dd539680c304a00e37f3ad0cb086d21d1d4f) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Bump animated-gif-detector to 1.2.0.](https://github.com/papandreou/impro/commit/0a52e7d27949cfe895095217ed1ef5ab546d2c6a) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Bump icc to 1.0.0 and set caret version.](https://github.com/papandreou/impro/commit/8fc1ffbeed6a6e37cd2537ff41abfec65dc3fd62) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Relax sharp to a tilde version of 0.23.0.](https://github.com/papandreou/impro/commit/17ca9d1a95ffca4ca1fbcc20ec320fb14e5321ba) ([Alex J Burke](mailto:alex@alexjeffburke.com))

### v0.5.0 (2019-11-19)

- [Do a small editorial pass on the README.](https://github.com/papandreou/impro/commit/6a57cb1b748ade835e78a2703e65d60478e41f4e) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Improve sharp resize processing.](https://github.com/papandreou/impro/commit/86d1ceac4135af109953da567f6a870d568d7e62) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Add LICENSE.](https://github.com/papandreou/impro/commit/1af5b3b1045b39dae0d327aac7981d29e2c26df9) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Expand README.](https://github.com/papandreou/impro/commit/47ac02dab06c966049f462628203ce32d3aa865e) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Wire the output of a gm commandLine on error.](https://github.com/papandreou/impro/commit/a9b771002b90cfefea127271371d2fc5ab97a246) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [+28 more](https://github.com/papandreou/impro/compare/v0.4.0...v0.5.0)

### v0.4.0 (2019-10-05)

- [Allow multiple type conversions through a pipeline.](https://github.com/papandreou/impro/commit/edcc7cbf6c7009415de3e322dcbeeb881f520d0a) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Bump exif-reader to 1.0.3 and set a caret version.](https://github.com/papandreou/impro/commit/9622391cd640965926f99b1866bc9408f900d7b1) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Add a test for a standard format conversion operation.](https://github.com/papandreou/impro/commit/59ce44230b0df001fe8b33cb949713681298706c) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Consistently dereference usedEngines in the tests.](https://github.com/papandreou/impro/commit/4d7f9b332c79d49cc17d8b27cbac8e79ac442488) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Correct a method name in a test.](https://github.com/papandreou/impro/commit/1911a27be704e8f6234806f522e5f750844568d5) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [+16 more](https://github.com/papandreou/impro/compare/v0.3.2...v0.4.0)

### v0.3.2 (2019-09-26)

- [Exclude coverage from prettier checks.](https://github.com/papandreou/impro/commit/a12feaa233f094ff8f1f70a00633dfcd2b47435b) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Support ignoreAspectRatio\(\) with current version of sharp.](https://github.com/papandreou/impro/commit/b7de6675aac3b5442c41df825be132f4b04ae1af) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Support withoutEnlargement\(\) with current version of sharp.](https://github.com/papandreou/impro/commit/65562131d84f9f544c6bd4cc931ef480a777290f) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Cleanup the operation combining code in sharp.](https://github.com/papandreou/impro/commit/878b84fa013f274311112adff5d36fae88132843) ([Alex J Burke](mailto:alex@alexjeffburke.com))

### v0.3.1 (2019-09-22)

- [Restore withoutEnlargement and ignoreAspectRatio for gm.](https://github.com/papandreou/impro/commit/9fbdb7e561f22ea3c111f1e5eb9ac69421aaf91a) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Ensure early exit for invalid resize & unskip the corresponding test.](https://github.com/papandreou/impro/commit/2dca2eb3b049e0c7021c6ce1b082e00fadbb1ca1) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Rework gm engine so it generates options to instance. apply early.](https://github.com/papandreou/impro/commit/3f5f309e3665ebcc0fac96a68651b7a87389aab5) ([Alex J Burke](mailto:alex@alexjeffburke.com))

### v0.3.0 (2019-09-17)

- [Add basic README.](https://github.com/papandreou/impro/commit/77b2925676faa5593f4ae7bbb3232210ea0e544e) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Improve tearing down the file stream added in 15a099e.](https://github.com/papandreou/impro/commit/c84ef12bab52933be15f2758888fd462cc6ae00a) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Restore and test the crop operation for jpegtran.](https://github.com/papandreou/impro/commit/a3dbefb8c67eed9b44003a1646d7a35c01d93dd6) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Exercise a gm stream error and fix the codepath after 554797e.](https://github.com/papandreou/impro/commit/eead1c174dfed1aecb31ebbc1cb34085b365ff45) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Exercise the gm engine and set the supported output types correctly.](https://github.com/papandreou/impro/commit/beec45661044387db4860a6d725b8f8e049b1265) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [+8 more](https://github.com/papandreou/impro/compare/v0.2.1...v0.3.0)

### v0.2.1 (2019-09-15)

- [Correct packaging mishap.](https://github.com/papandreou/impro/commit/933c824ec40febe2b6c651c58e8e88892ac8af05) ([Alex J Burke](mailto:alex@alexjeffburke.com))

### v0.2.0 (2019-09-15)

- [Adjust the EXIF test in ab0a0ac so it works on CI.](https://github.com/papandreou/impro/commit/b8a9da1c18f5d4dd158c972a48d6b30e77a9169c) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Production harden the pipeline error path and exhaustively test.](https://github.com/papandreou/impro/commit/554797e0b4995908b993c40e10cd3f3ff8645190) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Add a test that exercises EXIF metadata reading.](https://github.com/papandreou/impro/commit/ab0a0ac3f43c85661e44260265710d908d64c0f1) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Remove unused isOperationByEngineNameAndName mapping structure.](https://github.com/papandreou/impro/commit/784c33008079aa3a641830d29c29be5cca5dd718) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Remove the last use of lodash in Pipeline.](https://github.com/papandreou/impro/commit/a254944ddce017c9f37259688371b26f86500fd1) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [+12 more](https://github.com/papandreou/impro/compare/v0.1.0...v0.2.0)

### v0.1.0 (2019-09-04)

#### Pull requests

- [#2](https://github.com/papandreou/impro/pull/2) Restore to working order ([Alex J Burke](mailto:alex@alexjeffburke.com))

#### Commits to master

- [Convert top level variable definitions to const.](https://github.com/papandreou/impro/commit/3922eef638214d08cecfd9a9889d00c8e191e7da) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [prettier --write](https://github.com/papandreou/impro/commit/e9b8070f58631e48371068d26197af71a938fb7f) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [eslint --fix](https://github.com/papandreou/impro/commit/3ddddb4240e8e8962e18479311b10c21a31a8a37) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Bring in modern eslint setup with prettier.](https://github.com/papandreou/impro/commit/a809e638ccf37a5583f299671e67b70c5c50dc76) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [Repair a gifsicle test that was incorrectly bracketed.](https://github.com/papandreou/impro/commit/d4f62a82600a31d931549b5b540855fb5f6854d5) ([Alex J Burke](mailto:alex@alexjeffburke.com))
- [+1 more](https://github.com/papandreou/impro/compare/v0.0.1...v0.1.0)

### v0.0.1
#### Pull requests

- [#1](https://github.com/papandreou/impro/pull/1) Minor refactors ([Joel Mukuthu](mailto:jmu@one.com))

#### Commits to master

- [Update test fixtures because of resize algorithm changes in sharp.](https://github.com/papandreou/impro/commit/67c31e10e091b6c8d9b8015e82e0fca9e5f9d290) ([Andreas Lind](mailto:andreas@one.com))
- [Update dev deps.](https://github.com/papandreou/impro/commit/a8db46466ccbfefeb79cd19d37032cab0247578c) ([Andreas Lind](mailto:andreas@one.com))
- [Update sharp to 0.17.1.](https://github.com/papandreou/impro/commit/3c1013e5f804ca3d42c1571b17a201b6931c268c) ([Andreas Lind](mailto:andreas@one.com))
- [Travis cruft.](https://github.com/papandreou/impro/commit/35130239947e0de5f25cf9d0ac44ae061f04dbcf) ([Andreas Lind](mailto:andreas@one.com))
- [Travis & Coveralls integration.](https://github.com/papandreou/impro/commit/91062b3544d0b9d1224c4be9b2e704096cc83cb4) ([Andreas Lind](mailto:andreas@one.com))
- [+62 more](https://github.com/papandreou/impro/compare/67c31e10e091b6c8d9b8015e82e0fca9e5f9d290%5E...v0.0.1)

