import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('the real capture preload crops frames before JPEG emission and canvas video encoding', async () => {
  const source = await readFile(new URL('./capture-preload.cjs', import.meta.url), 'utf8');
  const draws = [];
  const context = vm.createContext({
    require: () => ({ ipcRenderer: { on() {}, send() {} } }),
    document: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: (...args) => draws.push(args) }) }) },
    console, setTimeout, clearTimeout, setInterval, clearInterval,
  });
  vm.runInContext(source, context);
  await vm.runInContext('capturingFrames = true; captureRegion = {x:.2,y:.1,width:.4,height:.5}; drawFrame({},1000,500,null)', context);
  assert.deepEqual(draws[0].slice(1), [200, 50, 400, 250, 0, 0, 400, 250]);
  assert.equal(vm.runInContext('frameCanvas.width', context), 400);
  assert.equal(vm.runInContext('frameCanvas.height', context), 250);
  assert.equal(vm.runInContext('croppedCanvas.width', context), 400);
  assert.equal(vm.runInContext('croppedCanvas.height', context), 250);
  draws.length = 0;
  await vm.runInContext('captureRegion = null; drawFrame({},1000,500,null)', context);
  assert.deepEqual(draws[0].slice(1), [0, 0, 1000, 500, 0, 0, 1000, 500]);
});
