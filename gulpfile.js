const gulp = require("gulp");
const sass = require("gulp-sass")(require("sass"));
const rename = require("gulp-rename");
const cleanCSS = require("gulp-clean-css");
const autoPrefix = require("gulp-autoprefixer");
const concatenate = require("gulp-concat");
const imagemin = require("gulp-imagemin");

const sassFiles = ["./src/sass/main.scss"];
const imageFiles = ["./src/images/*.+(png|jpg|gif|svg)"];

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

gulp.task("images", () => {
  return gulp
    .src(imageFiles)
    .pipe(imagemin())
    .pipe(gulp.dest("./public/images/"));
});

gulp.task("build", gulp.parallel(["sass", "images"]));

gulp.task("watch", (done) => {
  gulp.watch(sassFiles, gulp.series("sass"));
  gulp.watch(imageFiles, gulp.series("images"));
  done();
});

gulp.task("default", gulp.series("watch"));
