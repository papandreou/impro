const expect = require('unexpected');

const impro = require('../src/index');
const queryString = require('../src/queryString');

describe('queryString', function() {
  describe('parseImproQueryString()', function() {
    it('should return an object with the operations and the leftover parameters, given a query string', function() {
      expect(
        queryString.parseImproQueryString(impro, 'foo=bar&resize=120,120'),
        'to equal',
        {
          operations: [{ name: 'resize', args: [120, 120] }],
          leftover: 'foo=bar',
          consumed: 'resize=120,120'
        }
      );
    });

    it('should parse an engine and preserve any additional options passed to it', function() {
      expect(
        queryString.parseImproQueryString(
          impro,
          `svgfilter=runScript=addBogusElement.js+bogusElementId=theBogusElementId`
        ),
        'to equal',
        {
          operations: [
            {
              name: 'svgfilter',
              args: [
                {
                  runScript: 'addBogusElement.js',
                  bogusElementId: 'theBogusElementId'
                }
              ]
            }
          ],
          leftover: '',
          consumed:
            'svgfilter=runScript=addBogusElement.js+bogusElementId=theBogusElementId'
        }
      );
    });

    it('should parse an engine ignoring any restricted properties', function() {
      expect(
        queryString.parseImproQueryString(
          impro,
          `svgfilter=svgAssetPath=anything`
        ),
        'to equal',
        {
          operations: [
            {
              name: 'svgfilter',
              args: []
            }
          ],
          leftover: '',
          consumed: 'svgfilter=svgAssetPath=anything'
        }
      );
    });

    it('should parse an engine and ignore any invalid options', function() {
      expect(
        queryString.parseImproQueryString(impro, `pngcrush=8`),
        'to equal',
        {
          operations: [
            {
              name: 'pngcrush',
              args: []
            }
          ],
          leftover: '',
          consumed: 'pngcrush=8'
        }
      );
    });

    it('should parse metadata without options', function() {
      expect(queryString.parseImproQueryString(impro, 'metadata'), 'to equal', {
        operations: [
          {
            name: 'metadata',
            args: []
          }
        ],
        leftover: '',
        consumed: 'metadata'
      });
    });

    it('should parse a resize operation with only one of the pair (left)', function() {
      expect(
        queryString.parseImproQueryString(impro, 'resize=10,'),
        'to equal',
        {
          operations: [
            {
              name: 'resize',
              args: [10, null]
            }
          ],
          leftover: '',
          consumed: 'resize=10,'
        }
      );
    });

    it('should parse a resize operation with only one of the pair (right)', function() {
      expect(
        queryString.parseImproQueryString(impro, 'resize=,10'),
        'to equal',
        {
          operations: [
            {
              name: 'resize',
              args: [null, 10]
            }
          ],
          leftover: '',
          consumed: 'resize=,10'
        }
      );
    });

    it('should ensure a custom allowOperation function takes effect for engines', function() {
      impro.allowOperation = () => false;

      return expect(
        queryString.parseImproQueryString(impro, 'metadata'),
        'to equal',
        {
          operations: [],
          leftover: 'metadata',
          consumed: ''
        }
      ).finally(() => {
        delete impro.allowOperation;
      });
    });

    it('should support suppplying a custom allowOperation function directly', function() {
      expect(
        queryString.parseImproQueryString(impro, 'png', () => false),
        'to equal',
        {
          operations: [],
          leftover: 'png',
          consumed: ''
        }
      );
    });
  });
});
