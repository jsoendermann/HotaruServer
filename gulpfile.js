const gulp = require('gulp');
const ts = require('gulp-typescript');
const babel = require('gulp-babel');


gulp.task('default', () => {
  const tsProject = ts.createProject('./tsconfig.json');
  const babelrc = require('./.babelrc.json');

  return tsProject.src()
    .pipe(tsProject())
    .js
    .pipe(babel(babelrc))
    .pipe(gulp.dest('lib'));
});

gulp.watch('src/**/*.ts', ['default']);
