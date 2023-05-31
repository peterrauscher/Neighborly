const gulp = require("gulp");
const sass = require("gulp-sass")(require("sass"));
const uglify = require("gulp-uglify");
const rename = require("gulp-rename");
const cleanCSS = require("gulp-clean-css");
const autoPrefix = require("gulp-autoprefixer");
const concatenate = require("gulp-concat");

const sassFiles = ["./src/sass/*.s?ss"];
const jsFiles = ["./src/js/*.js"];
// TODO minify images for optimization
// const imageFiles = ["./src/images/*.+(png|jpg|gif)"]

gulp.task("sass", () => {
  return gulp
    .src(sassFiles)
    .pipe(sass())
    .pipe(concatenate("styles.css"))
    .pipe(gulp.dest("./public/css/"))
    .pipe(autoPrefix())
    .pipe(cleanCSS())
    .pipe(rename("styles.min.css"))
    .pipe(gulp.dest("./public/css/"));
});

gulp.task("js", () => {
  return gulp
    .src(jsFiles)
    .pipe(concatenate("main.js"))
    .pipe(gulp.dest("./public/js/"))
    .pipe(uglify())
    .pipe(rename("main.min.js"))
    .pipe(gulp.dest("./public/js/"));
});

gulp.task("build", gulp.parallel(["sass", "js"]));

gulp.task("watch", (done) => {
  gulp.watch(sassFiles, gulp.series("sass"));
  gulp.watch(jsFiles, gulp.series("js"));
  done();
});

gulp.task("default", gulp.series("watch"));
