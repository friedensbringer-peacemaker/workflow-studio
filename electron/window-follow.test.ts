import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { followWindow } from './window-follow';
import { integratedWorkspaceBounds, isStudioWindowMode } from '../common/window-layout';

class FakeWindow extends EventEmitter {
  x = 0; y = 0; maximized = false; minimized = false; destroyed = false;
  getBounds() { return { x: this.x, y: this.y }; }
  isDestroyed() { return this.destroyed; }
  isMaximized() { return this.maximized; }
  isMinimized() { return this.minimized; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; this.emit('move'); }
}
test('both windows follow both axes, including negative monitor coordinates, without recursion', () => {
  const anchor = new FakeWindow(); const child = new FakeWindow(); child.setPosition(400, 10);
  followWindow(anchor, child);
  anchor.setPosition(-120, 40); assert.deepEqual(child.getBounds(), { x: 280, y: 50 });
  anchor.emit('moved'); assert.deepEqual(child.getBounds(), { x: 280, y: 50 });
  child.setPosition(600, 100);
  assert.deepEqual(anchor.getBounds(), { x: 200, y: 90 });
  child.emit('moved'); anchor.emit('move');
  assert.deepEqual(child.getBounds(), { x: 600, y: 100 });
  assert.deepEqual(anchor.getBounds(), { x: 200, y: 90 });
});
test('redocking resets movement baseline and closed windows detach listeners', () => {
  const anchor = new FakeWindow(); const child = new FakeWindow();
  const docking = followWindow(anchor, child);
  docking.reposition(() => { anchor.setPosition(30, 20); child.setPosition(430, 20); });
  assert.deepEqual(anchor.getBounds(), { x: 30, y: 20 });
  assert.deepEqual(child.getBounds(), { x: 430, y: 20 });
  anchor.x = 100; child.x = 500; docking.reset(); anchor.emit('move');
  assert.equal(child.x, 500);
  child.emit('closed'); anchor.setPosition(200, 0); assert.equal(child.x, 500);
  assert.equal(anchor.listenerCount('move'), 0); assert.equal(child.listenerCount('closed'), 0);
});
test('maximized and minimized companions are left to the window manager', () => {
  const anchor = new FakeWindow(); const child = new FakeWindow(); followWindow(anchor, child);
  child.maximized = true; anchor.setPosition(30, 20); assert.equal(child.x, 0);
  child.maximized = false; child.minimized = true; anchor.setPosition(50, 40); assert.equal(child.x, 0);
  child.minimized = false; anchor.setPosition(55, 45); assert.deepEqual(child.getBounds(), { x: 5, y: 5 });
});

test('floating detaches both movement directions and repeated docking never doubles listeners', () => {
  const recorder = new FakeWindow(); const studio = new FakeWindow();
  for (let i = 0; i < 4; i++) {
    const docking = followWindow(recorder, studio);
    assert.equal(recorder.listenerCount('move'), 1);
    docking.dispose();
    const before = studio.getBounds(); recorder.setPosition(recorder.x + 20, recorder.y + 10);
    assert.deepEqual(studio.getBounds(), before);
    const recorderBefore = recorder.getBounds(); studio.setPosition(studio.x + 40, studio.y + 30);
    assert.deepEqual(recorder.getBounds(), recorderBefore);
    assert.equal(studio.listenerCount('move'), 0);
  }
  followWindow(recorder, studio);
  const before = studio.getBounds(); recorder.setPosition(recorder.x + 10, recorder.y + 5);
  assert.deepEqual(studio.getBounds(), { x: before.x + 10, y: before.y + 5 });
});

test('integrated workspace fits negative-origin and small displays and accepts only known modes', () => {
  const recorder = { x: -30, y: 900, width: 400, height: 500 };
  for (const area of [{ x: -1920, y: 0, width: 1920, height: 1080 }, { x: 0, y: 0, width: 800, height: 600 }]) {
    const bounds = integratedWorkspaceBounds(recorder, area);
    assert.ok(bounds.x >= area.x && bounds.y >= area.y);
    assert.ok(bounds.x + bounds.width <= area.x + area.width);
    assert.ok(bounds.y + bounds.height <= area.y + area.height);
  }
  assert.ok(['integrated', 'docked', 'minimal'].every(isStudioWindowMode));
  assert.equal(isStudioWindowMode('external'), false); assert.equal(isStudioWindowMode({ mode: 'docked' }), false);
});
