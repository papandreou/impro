function parseImproQueryString(improInstance, queryString, allowOperation) {
  allowOperation =
    typeof allowOperation === 'function'
      ? allowOperation
      : improInstance.allowOperation;

  var keyValuePairs = queryString.split('&');
  var operations = [];
  var leftOverQueryStringFragments = [];
  var consumedQueryStringFragments = [];

  for (const keyValuePair of keyValuePairs) {
    var matchKeyValuePair = keyValuePair.match(/^([^=]+)(?:=(.*))?/);
    if (matchKeyValuePair) {
      var operationName = decodeURIComponent(matchKeyValuePair[1]);
      // Split by non-URL encoded comma or plus:
      var operationArgs = matchKeyValuePair[2]
        ? matchKeyValuePair[2].split(/[+,]/).map(function(arg) {
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
        operationArgs.forEach(arg => {
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
        operationArgs = operationArgs.map(arg => arg || null);
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
          args: operationArgs
        });
        consumedQueryStringFragments.push(keyValuePair);
      }
    }
  }

  return {
    operations: operations,
    leftover: leftOverQueryStringFragments.join('&'),
    consumed: consumedQueryStringFragments.join('&')
  };
}

exports.parseImproQueryString = parseImproQueryString;
