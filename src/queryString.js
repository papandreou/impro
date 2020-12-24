function parseImproQueryString(queryString, improInstance, allowOperation) {
  allowOperation =
    typeof allowOperation === 'function'
      ? allowOperation
      : improInstance.allowOperation;

  const keyValuePairs = queryString.split('&');
  const operations = [];
  const leftOverQueryStringFragments = [];
  const consumedQueryStringFragments = [];

  for (const keyValuePair of keyValuePairs) {
    const matchKeyValuePair = keyValuePair.match(/^([^=]+)(?:=(.*))?/);
    if (matchKeyValuePair) {
      const operationName = decodeURIComponent(matchKeyValuePair[1]);
      // Split by non-URL encoded comma or plus:
      let operationArgs = matchKeyValuePair[2]
        ? matchKeyValuePair[2].split(/[+,]/).map((arg) => {
            arg = decodeURIComponent(arg);
            if (/^\d+$/.test(arg)) {
              return parseInt(arg, 10);
            } else if (arg === 'true') {
              return true;
            } else if (arg === 'false') {
              return false;
            } else {
              return arg;
            }
          })
        : [];

      if (operationName in improInstance.engineByName) {
        // engines accept only a single options object argument, so
        // in cases where the query string contains options intended
        // for the engine itself we must put them in an object which
        // we can then pass as that only supported argument
        const engineOptions = {};
        operationArgs.forEach((arg) => {
          if (typeof arg !== 'string' || arg.indexOf('=') === -1) return;
          const [optionKey, optionValue] = arg.split('=');
          if (improInstance.restrictedOptions.includes(optionKey)) return;
          engineOptions[optionKey] = optionValue;
        });

        if (Object.keys(engineOptions).length > 0) {
          operationArgs = [engineOptions];
        } else {
          operationArgs = [];
        }
      }

      // empty resize args must be passed to engines as null
      if (operationName === 'resize') {
        operationArgs = operationArgs.map((arg) => arg || null);
      }

      if (
        !improInstance.isValidOperation(operationName, operationArgs) ||
        (typeof allowOperation === 'function' &&
          !allowOperation(operationName, operationArgs))
      ) {
        leftOverQueryStringFragments.push(keyValuePair);
      } else {
        operations.push({
          name: operationName,
          args: operationArgs,
        });
        consumedQueryStringFragments.push(keyValuePair);
      }
    }
  }

  return {
    operations: operations,
    leftover: leftOverQueryStringFragments.join('&'),
    consumed: consumedQueryStringFragments.join('&'),
  };
}

const resizeOptions = {
  ignoreAspectRatio: true,
  withoutEnlargement: true,
};

function makeEngineAndArgsRegex(engineNames) {
  return new RegExp(`^(${engineNames.join('|')})(?:=(.*))?`);
}

function prepareLegacyQueryString(queryString, improInstance) {
  const engineNames = Object.keys(improInstance.engineByName);
  const queryStringEngineAndArgsRegex = makeEngineAndArgsRegex(engineNames);

  const keyValuePairs = queryString.split('&');
  const queryStringFragments = [];

  let hasResize = false;
  let optionToResize;

  for (const pair of keyValuePairs) {
    let m;

    if ((m = pair.match(queryStringEngineAndArgsRegex)) !== null) {
      const [, engineName, engineArgs = ''] = m;
      const result = [engineName];
      const splitChar = engineArgs.includes('+') ? '+' : ',';
      const remaining = engineArgs.split(splitChar);

      let isEngineOptions = false;
      let lastSeenOptionIndex = -1;
      let engineOptions;

      for (const [index, bit] of remaining.entries()) {
        if (engineName === 'svgfilter' && bit[0] === '-' && bit[1] === '-') {
          if (!isEngineOptions) {
            isEngineOptions = true;
            engineOptions = [];
          }
          engineOptions.push(bit.slice(2));
        } else if (bit[0] === '-') {
          result.push(bit.slice(1));
          lastSeenOptionIndex = index + 1; // account for the engine entry
        } else if (engineName === 'pngquant') {
          result.push(`ncolors=${bit}`);
        } else if (lastSeenOptionIndex > -1) {
          result[lastSeenOptionIndex] += `=${bit}`;
        }
      }

      if (isEngineOptions) {
        result[0] += `=${engineOptions.join('+')}`;
      }

      queryStringFragments.push(...result);
    } else {
      const keyAndValue = pair.split('=');
      if (keyAndValue.length === 1) keyAndValue.unshift('');
      const [op, arg] = keyAndValue;

      if (op === 'setFormat') {
        let format = arg.toLowerCase();
        if (format === 'jpg') {
          format = 'jpeg';
        }
        queryStringFragments.push(format);
      } else if (arg in resizeOptions && !hasResize) {
        optionToResize = arg;
      } else {
        let fragment = pair;
        if (op === 'resize') {
          if (arg.indexOf('+') > -1) {
            // specified using a plus operator
            fragment = fragment.replace('+', ',');
          } else if (arg.indexOf(',') === -1) {
            // single value form of resize
            fragment += ',';
          }
        }
        queryStringFragments.push(fragment);
      }

      if (op === 'resize') {
        if (optionToResize) {
          queryStringFragments.push(optionToResize);
          optionToResize = undefined;
        } else {
          hasResize = true;
        }
      }
    }
  }

  return queryStringFragments.join('&');
}

function parseLegacyQueryString(queryString, improInstance, allowOperation) {
  const improQueryString = prepareLegacyQueryString(queryString, improInstance);
  return parseImproQueryString(improQueryString, improInstance, allowOperation);
}

exports.parseImproQueryString = parseImproQueryString;
exports.prepareLegacyQueryString = prepareLegacyQueryString;
exports.parseLegacyQueryString = parseLegacyQueryString;
