// import nodePath from 'node:path'

import gulp from 'gulp'
import gulpIf from 'gulp-if'
import gulpRename from 'gulp-rename'
import gulpReplace from 'gulp-replace'

import browserSync from 'browser-sync'

import * as dartSass from 'sass'
import gulpSass from 'gulp-sass'
const sass = gulpSass(dartSass)

import postcss from 'gulp-postcss'
import postcssLoadConfig from 'postcss-load-config'
import tailwindcss from '@tailwindcss/postcss'
import sourcemaps from 'gulp-sourcemaps'
// import purgecss from 'gulp-purgecss'

// import webpcss from 'gulp-webpcss' // TODO: deprecated
// import avifWebpCss from 'gulp-avif-css' // ! bug when render
import webImagesCSS from 'gulp-web-images-css'
// import * as pxToRemConverter from 'gulp-px2rem-converter' // ! using postcss-pxtorem

import { env } from '../../config/env.js'
import { path } from '../../config/path.js'
import { build } from '../../config/build.js'
import {
    plumberWithErrorHandler,
    NOTIFICATION_HANDLER_TITLES,
} from '../../helpers/error-handler.js'
import { replaceCssPaths } from '../../helpers/path-resolver.js'

// * --- EXPORT GULP TASK FOR SCSS/CSS FILES
// * ---------------------------------------
export function styles() {
    // * Формируем путь в зависимости от флагов окружения
    let cssToAssets = '../assets/'

    if (env.isLocal) {
        // В локальном режиме (file:///) используем строго относительные пути
        if (env.isInlineCSS) {
            // Если CSS встраивается в HTML: для языковых подпапок нужно подняться на уровень выше
            cssToAssets = env.isI18N ? '../assets/' : './assets/'
        } else {
            // Внешний CSS лежит в dist/css/, до dist/assets/ всегда ровно один шаг назад
            cssToAssets = '../assets/'
        }
    } else if (env.isInlineCSS && !env.assetPrefix) {
        // Если инлайн-CSS используется без домена и без префикса
        cssToAssets = env.isI18N ? '../assets/' : './assets/'
    } else {
        // В остальных режимах (dev, prod, gh-pages) берем абсолютный путь из env.js
        cssToAssets = `${env.assetPrefix}assets/`
    }

    return (
        gulp
            // * берем исходники (убрали нативный sourcemaps из опций)
            .src(path.src.getStyles(env.cssMode).files)
            // * подключаем plumber, чтобы gulp не падал при ошибке
            .pipe(plumberWithErrorHandler(NOTIFICATION_HANDLER_TITLES.STYLES.DEFAULT))

            // * Инициализируем sourcemaps (включается только в dev/staging)
            .pipe(gulpIf(env.buildMode.isDev || env.buildMode.isStaging, sourcemaps.init()))

            // * билдим css через sass | если включен режим SCSS
            .pipe(
                gulpIf(
                    env.cssMode === 'scss',
                    sass({
                        // * expanded always, bugs with webImagesCSS when compressed
                        style: 'expanded',
                        quietDeps: true,
                        loadPaths: [path.src.node_modules],
                    }),
                ),
            )

            // ! фикс алиасов для Tailwind: @css/ -> ./
            .pipe(
                gulpIf(
                    env.cssMode === 'css',
                    gulpReplace(/@import\s+['"]@css\/(.*?)['"]/g, "@import './$1'"),
                ),
            )

            // * универсальная замена алиасов | @fonts, @images ... etc
            .pipe(replaceCssPaths(cssToAssets))

            // ! спрайты не работают в css !!!
            .pipe(
                gulpReplace(/@icons\/(.+?)\.svg/g, (match, p1) => {
                    const id = p1.replace(/\//g, '--')
                    return `${cssToAssets}icons/sprite.svg#${id}`
                }),
            )

            // * генерируем классы .avif и .webp для background-image
            .pipe(
                gulpIf(
                    env.cssMode === 'scss',
                    webImagesCSS({
                        mode: 'all',
                    }),
                ),
            )

            // * прогоняем Tailwind если сборка под CSS (Tailwind)
            .pipe(
                gulpIf(
                    env.cssMode === 'css',
                    postcss([
                        tailwindcss({
                            // Явно указываем базовую директорию для поиска исходников
                            base: process.cwd(),
                        }),
                    ]),
                ),
            )

            // * добавляем к имени суффикс .min
            .pipe(gulpRename({ suffix: '.min' }))

            // * Записываем sourcemaps в файл .map (только в dev/staging)
            .pipe(gulpIf(env.buildMode.isDev || env.buildMode.isStaging, sourcemaps.write('.')))

            // * кладем результат в папку сборки (убрали нативный sourcemaps)
            .pipe(gulp.dest(build.styles))

            .on('end', () => {
                // * update dev server
                browserSync.reload()
            })
    )
}

export function optimizeStyles() {
    return (
        gulp
            .src(`${build.styles}**/*.min.css`)
            .pipe(plumberWithErrorHandler(NOTIFICATION_HANDLER_TITLES.STYLES.OPTIMIZE))

            // * Инициализируем sourcemaps и подгружаем существующие карты (если они есть)
            .pipe(
                gulpIf(
                    env.buildMode.isDev || env.buildMode.isStaging,
                    sourcemaps.init({ loadMaps: true }),
                ),
            )

            // * обрабатываем полученный css с помощью postcss
            .pipe(
                postcss((file) =>
                    postcssLoadConfig(
                        {
                            file,
                            config: {
                                ctx: {
                                    isMobileFirst: env.isMobileFirst,
                                    purgePaths: [
                                        `${build.html}**/*.html`,
                                        `${build.libs}**/*.js`,
                                        `${build.scripts}**/*.js`,
                                    ],
                                },
                            },
                        },
                        // * Принудительно ищем конфиг в папке src/
                        process.cwd(),
                    ),
                ),
            )

            // * Записываем обновленные sourcemaps
            .pipe(gulpIf(env.buildMode.isDev || env.buildMode.isStaging, sourcemaps.write('.')))

            // * перезаписываем существующий *.min.css файл
            .pipe(gulp.dest(build.styles))
            .on('end', () => browserSync.reload())
    )
}

// * --- REGISTER GULP TASK
// * ----------------------
gulp.task('styles', styles)
