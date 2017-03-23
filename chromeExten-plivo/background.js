chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('index.html', {
    'outerBounds': {
      'width': 1233,
      'height': 707
    }
  });
});