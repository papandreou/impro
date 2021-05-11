const requireOr = require('../requireOr');

const PngCrush = requireOr('pngcrush');

module.exports = {
  name: 'pngcrush',
  unavailable: !PngCrush,
  inputTypes: ['png'],
  outputTypes: ['png'],
  operations: ['brute', 'noreduce', 'reduce', 'rem'],
  validateOperation: function (name, args) {
    switch (name) {
      case 'brute':
      case 'noreduce':
      case 'reduce':
        return args.length === 0;
      case 'rem':
        return args.length >= 1 && args.every((arg) => /^[a-z]{4}$/i.test(arg));
    }
    // usage: pngcrush [options] infile.png outfile.png
    //        pngcrush -e ext [other options] file.png ...
    //        pngcrush -d dir/ [other options] file.png ...
    //        pngcrush -n -v file.png ...
    // options:
    //       -already already_crushed_size [e.g., 8192]
    //          -bail (bail out of trial when size exceeds best size found
    //     -bit_depth depth (bit_depth to use in output file)
    //       -blacken (zero samples underlying fully-transparent pixels)
    //         -brute (use brute-force: try 138 different methods [11-148])
    //             -c color_type of output file [0, 2, 4, or 6]
    //             -d directory_name/ (where output files will go)
    //  -double_gamma (used for fixing gamma in PhotoShop 5.0/5.02 files)
    //             -e extension  (used for creating output filename)
    //             -f user_filter [0-5] for specified method
    //           -fix (fix otherwise fatal conditions such as bad CRCs)
    //         -force (write a new output file even if larger than input)
    //             -g gamma (float or fixed*100000, e.g., 0.45455 or 45455)
    //       -huffman (use only zlib strategy 2, Huffman-only)
    //          -iccp length "Profile Name" iccp_file
    //          -keep chunk_name
    //             -l zlib_compression_level [0-9] for specified method
    //          -loco ("loco crush" truecolor PNGs)
    //             -m method [1 through 150]
    //           -max maximum_IDAT_size [default 8192]
    //           -mng (write a new MNG, do not crush embedded PNGs)
    //             -n (no save; doesn't do compression or write output PNG)
    //           -new (Use new default settings (-force and -reduce))
    //  -newtimestamp (Reset file modification time [default])
    //        -nobail (do not bail out early from trial -- see "-bail")
    //   -nofilecheck (do not check for infile.png == outfile.png)
    //      -nolimits (turns off limits on width, height, cache, malloc)
    //      -noreduce (turns off "-reduce" operations)
    //           -old (Use old default settings (no -force and no -reduce))
    //  -oldtimestamp (Do not reset file modification time)
    //            -ow (Overwrite)
    //    -plte_len n (obsolete; positive "n" enables palette reduction)
    //             -q (quiet)
    //        -reduce (do lossless color-type or bit-depth reduction)
    //           -rem chunkname (or "alla" or "allb")
    // -replace_gamma gamma (float or fixed*100000) even if it is present.
    //           -res resolution in dpi
    //           -rle (use only zlib strategy 3, RLE-only)
    //          -save (keep all copy-unsafe PNG chunks)
    //          -srgb [0, 1, 2, or 3]
    //          -ster [0 or 1]
    //          -text b[efore_IDAT]|a[fter_IDAT] "keyword" "text"
    //    -trns_array n trns[0] trns[1] .. trns[n-1]
    //          -trns index red green blue gray
    //             -v (display more detailed information)
    //       -version (display the pngcrush version)
    //             -w compression_window_size [32, 16, 8, 4, 2, 1, 512]
    //             -z zlib_strategy [0, 1, 2, or 3] for specified method
    //          -zmem zlib_compression_mem_level [1-9, default 9]
    //          -ztxt b[efore_IDAT]|a[fter_IDAT] "keyword" "text"
    //             -h (help and legal notices)
    //             -p (pause)
  },
  execute: function (pipeline, operations, options) {
    const commandLineArgs = [];
    operations.forEach(({ name, args }) => {
      if (name === 'rem') {
        args.forEach((arg) => {
          commandLineArgs.push('-rem', arg);
        });
      } else {
        commandLineArgs.push('-' + name, ...args);
      }
    });

    pipeline._attach(new PngCrush(commandLineArgs));

    return commandLineArgs;
  },
};
