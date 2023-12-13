const childProcess = require('child_process');

function whichSyncSafe(cmd) {
  try {
    const output = childProcess.execFileSync('which', [cmd]);
    return output.toString().trimEnd();
  } catch (err) {
    return null;
  }
}

exports.whichSyncSafe = whichSyncSafe;
