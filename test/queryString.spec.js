const expect = require('unexpected');

const impro = require('../src/index');
const queryString = require('../src/queryString');

describe('queryString', () => {
  describe('parseImproQueryString()', () => {
    it('should return an object with the operations and the leftover parameters, given a query string', () => {
      expect(
        queryString.parseImproQueryString('foo=bar&resize=120,120', impro),
        'to equal',
        {
          operations: [{ name: 'resize', args: [120, 120] }],
          leftover: 'foo=bar',
          consumed: 'resize=120,120',
        }
      );
    });

    it('should parse an engine and preserve any additional options passed to it', () => {
      expect(
        queryString.parseImproQueryString(
          `svgfilter=runScript=addBogusElement.js+bogusElementId=theBogusElementId`,
          impro
        ),
        'to equal',
        {
          operations: [
            {
              name: 'svgfilter',
              args: [
                {
                  runScript: 'addBogusElement.js',
                  bogusElementId: 'theBogusElementId',
                },
              ],
            },
          ],
          leftover: '',
          consumed:
            'svgfilter=runScript=addBogusElement.js+bogusElementId=theBogusElementId',
        }
      );
    });

    it('should parse an engine ignoring any restricted properties', () => {
      expect(
        queryString.parseImproQueryString(
          `svgfilter=svgAssetPath=anything`,
          impro
        ),
        'to equal',
        {
          operations: [
            {
              name: 'svgfilter',
              args: [],
            },
          ],
          leftover: '',
          consumed: 'svgfilter=svgAssetPath=anything',
        }
      );
    });

    it('should parse an engine and ignore any invalid options', () => {
      expect(
        queryString.parseImproQueryString(`pngcrush=8`, impro),
        'to equal',
        {
          operations: [
            {
              name: 'pngcrush',
              args: [],
            },
          ],
          leftover: '',
          consumed: 'pngcrush=8',
        }
      );
    });

    it('should parse metadata without options', () => {
      expect(queryString.parseImproQueryString('metadata', impro), 'to equal', {
        operations: [
          {
            name: 'metadata',
            args: [],
          },
        ],
        leftover: '',
        consumed: 'metadata',
      });
    });

    it('should parse a resize operation with only one of the pair (left)', () => {
      expect(
        queryString.parseImproQueryString('resize=10,', impro),
        'to equal',
        {
          operations: [
            {
              name: 'resize',
              args: [10, null],
            },
          ],
          leftover: '',
          consumed: 'resize=10,',
        }
      );
    });

    it('should parse a resize operation with only one of the pair (right)', () => {
      expect(
        queryString.parseImproQueryString('resize=,10', impro),
        'to equal',
        {
          operations: [
            {
              name: 'resize',
              args: [null, 10],
            },
          ],
          leftover: '',
          consumed: 'resize=,10',
        }
      );
    });

    it('should ensure a custom allowOperation function takes effect for engines', () => {
      impro.allowOperation = () => false;

      return expect(
        queryString.parseImproQueryString('metadata', impro),
        'to equal',
        {
          operations: [],
          leftover: 'metadata',
          consumed: '',
        }
      ).finally(() => {
        delete impro.allowOperation;
      });
    });

    it('should support suppplying a custom allowOperation function directly', () => {
      expect(
        queryString.parseImproQueryString('png', impro, () => false),
        'to equal',
        {
          operations: [],
          leftover: 'png',
          consumed: '',
        }
      );
    });
  });

  describe('prepareLegacyQueryString()', () => {
    const localExpect = expect.clone();

    localExpect.addAssertion(
      '<string> when prepared <assertion>',
      (expect, subject) => {
        expect.errorMode = 'nested';

        return expect.shift(
          queryString.prepareLegacyQueryString(subject, impro)
        );
      }
    );

    it('should parse resize (comma separator)', () => {
      localExpect('resize=800,800', 'when prepared to equal', 'resize=800,800');
    });

    it('should parse resize (plus separator)', () => {
      localExpect('resize=800+800', 'when prepared to equal', 'resize=800,800');
    });

    it('should parse svgfilter with options', () => {
      localExpect(
        'svgfilter=--runScript=addBogusElement.js,--bogusElementId=theBogusElementId',
        'when prepared to equal',
        'svgfilter=runScript=addBogusElement.js+bogusElementId=theBogusElementId'
      );
    });

    it('should parse setFormat and other arguments', () => {
      localExpect(
        'setFormat=JPG&resize=800,800',
        'when prepared to equal',
        'jpeg&resize=800,800'
      );
    });

    it('should parse ignoreAspectRatio followed by resize', () => {
      localExpect(
        'ignoreAspectRatio&resize=800,800',
        'when prepared to equal',
        'resize=800,800&ignoreAspectRatio'
      );
    });

    it('should parse withoutEnlargement followed by resize', () => {
      localExpect(
        'withoutEnlargement&resize=800,800',
        'when prepared to equal',
        'resize=800,800&withoutEnlargement'
      );
    });

    it('should parse resize followed by withoutEnlargement', () => {
      localExpect(
        'resize=800,800&withoutEnlargement',
        'when prepared to equal',
        'resize=800,800&withoutEnlargement'
      );
    });

    it('should parse jpegtran and an argument with -flip', () => {
      localExpect(
        'jpegtran=-grayscale,-flip,horizontal',
        'when prepared to equal',
        'jpegtran&grayscale&flip=horizontal'
      );
    });

    it('should parse optipng with no argument', () => {
      localExpect('optipng', 'when prepared to equal', 'optipng');
    });

    it('should parse pngquant with integer argument correctly', () => {
      localExpect(
        'resize=800,800&pngquant=256',
        'when prepared to equal',
        'resize=800,800&pngquant&ncolors=256'
      );
    });

    it('should parse pngcrush with -rm argument correctly (using -)', () => {
      localExpect(
        'resize=800,800&pngcrush=-rem,gAMA',
        'when prepared to equal',
        'resize=800,800&pngcrush&rem=gAMA'
      );
    });

    it('should parse pngcrush with -rm argument correctly (using +)', () => {
      localExpect(
        'resize=800,800&pngcrush=-rem+pHYs',
        'when prepared to equal',
        'resize=800,800&pngcrush&rem=pHYs'
      );
    });

    it('should parse multiple engines and their operations', () => {
      localExpect(
        'resize=800,800&pngquant=8&pngcrush=-rem,gAMA',
        'when prepared to equal',
        'resize=800,800&pngquant&ncolors=8&pngcrush&rem=gAMA'
      );
    });

    it('should parse the single format form of resize', () => {
      localExpect('resize=800', 'when prepared to equal', 'resize=800,');
    });
  });

  describe('parseLegacyQueryString()', () => {
    it('should parse setFormat and other arguments', () => {
      expect(
        queryString.parseLegacyQueryString('setFormat=png', impro),
        'to equal',
        {
          operations: [{ name: 'png', args: [] }],
          leftover: '',
          consumed: 'png',
        }
      );
    });
  });
});
