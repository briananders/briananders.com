import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);

// environment.js reads window.location.hostname via an IIFE at require time,
// so a window global must exist before any require of browser modules.
const bootstrapDom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'http://localhost/' });
global.window = bootstrapDom.window;
global.document = bootstrapDom.window.document;

const YoutubeModal = require('../src/js/_modules/youtube-modal.js');

describe('YoutubeModal', () => {
  let triggerButton;
  let modal;

  beforeEach(() => {
    // Fresh DOM per test so keydown/event listeners don't accumulate across tests.
    const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.KeyboardEvent = dom.window.KeyboardEvent;

    triggerButton = document.createElement('button');
    triggerButton.classList.add('yt-modal-trigger');
    triggerButton.dataset.videoId = 'test123';
    document.body.appendChild(triggerButton);

    modal = new YoutubeModal({ triggerScope: '.yt-modal-trigger' });
    modal.init();
  });

  test('clicking trigger appends modal elements to DOM', () => {
    triggerButton.click();

    assert.ok(document.querySelector('.youtube-modal-overlay'), 'overlay should be in DOM');
    assert.ok(document.querySelector('.youtube-modal-container'), 'container should be in DOM');
    assert.ok(document.querySelector('.youtube-modal-close'), 'close button should be in DOM');
  });

  test('clicking trigger renders iframe with correct video ID in src', () => {
    triggerButton.click();

    const iframe = document.querySelector('iframe');
    assert.ok(iframe, 'iframe should exist');
    assert.ok(
      iframe.getAttribute('src').includes('youtube.com/embed/test123'),
      'src should include the video ID',
    );
  });

  test('clicking trigger adds open class after timeout', (t) => {
    t.mock.timers.enable(['setTimeout']);

    triggerButton.click();
    t.mock.timers.tick(10);

    assert.ok(
      document.documentElement.classList.contains('youtube-modal-open'),
      'open class should be added to documentElement',
    );
  });

  test('clicking overlay removes modal from DOM after timeout', (t) => {
    t.mock.timers.enable(['setTimeout']);

    triggerButton.click();
    document.querySelector('.youtube-modal-overlay').click();
    t.mock.timers.tick(300);

    assert.equal(document.querySelector('.youtube-modal-overlay'), null, 'overlay should be removed');
    assert.equal(document.querySelector('.youtube-modal-container'), null, 'container should be removed');
    assert.equal(document.querySelector('.youtube-modal-close'), null, 'close button should be removed');
  });

  test('clicking close button removes modal from DOM after timeout', (t) => {
    t.mock.timers.enable(['setTimeout']);

    triggerButton.click();
    document.querySelector('.youtube-modal-close').click();
    t.mock.timers.tick(300);

    assert.equal(document.querySelector('.youtube-modal-overlay'), null, 'overlay should be removed');
    assert.equal(document.querySelector('.youtube-modal-container'), null, 'container should be removed');
  });

  test('Escape key removes modal from DOM after timeout', (t) => {
    t.mock.timers.enable(['setTimeout']);

    triggerButton.click();
    document.dispatchEvent(new global.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    t.mock.timers.tick(300);

    assert.equal(document.querySelector('.youtube-modal-overlay'), null, 'overlay should be removed after Escape');
  });

  test('playlist trigger generates videoseries embed URL', () => {
    document.body.innerHTML = '';
    const playlistTrigger = document.createElement('button');
    playlistTrigger.classList.add('yt-modal-trigger');
    playlistTrigger.dataset.playlistId = 'PLtest456';
    document.body.appendChild(playlistTrigger);

    const playlistModal = new YoutubeModal({ triggerScope: '.yt-modal-trigger' });
    playlistModal.init();
    playlistTrigger.click();

    const iframe = document.querySelector('iframe');
    assert.ok(iframe, 'iframe should exist');
    assert.ok(
      iframe.getAttribute('src').includes('videoseries?list=PLtest456'),
      'playlist src should use videoseries format',
    );
  });

  test('destroy() prevents trigger click from opening the modal', () => {
    modal.destroy();
    triggerButton.click();

    assert.equal(document.querySelector('.youtube-modal-overlay'), null, 'modal should not open after destroy');
    assert.equal(document.querySelector('.youtube-modal-container'), null, 'container should not appear after destroy');
  });

  test('destroy() + reinit does not accumulate event listeners', () => {
    modal.destroy();

    const modal2 = new YoutubeModal({ triggerScope: '.yt-modal-trigger' });
    modal2.init();

    // Spy on appendChild to count openModal invocations.
    // Each openModal call appends exactly 3 elements (overlay, container, closeButton).
    let appendCount = 0;
    const origAppend = document.body.appendChild.bind(document.body);
    document.body.appendChild = (node) => {
      appendCount++;
      return origAppend(node);
    };

    triggerButton.click();

    assert.equal(appendCount, 3, 'openModal should fire exactly once (3 appends) after destroy + reinit');
  });
});
