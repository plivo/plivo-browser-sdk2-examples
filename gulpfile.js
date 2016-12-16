'use strict';

var gulp = require('gulp');
var server = require('gulp-express');

gulp.task('default', function() {
  server.run(['server.js']);

  // Restart the server when file changes
  gulp.watch(['public/**/*.js'], server.notify);
});