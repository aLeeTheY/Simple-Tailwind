/* eslint-disable no-console */
import fs from 'fs'
import gulp from 'gulp'
import nodePath from 'path'
import fastGlob from 'fast-glob'
import browserSync from 'browser-sync'
import Beasties from 'beasties'

import { env } from '../../config/env.js'
import { build } from '../../config/build.js'
import { notify, NOTIFICATION_HANDLER_TITLES } from '../../helpers/error-handler.js'

// ! Превращает алиасов-плейсхолдеров в рабочие URL: @scss/main.scss -> /css/main.min.css
// ? После резолва Beasties увидит /css/main.min.css
function resolveAliasesForCritical(html) {
    return html.replace(
        /@(scss|css)\/([^"'\s)]+)/g,
        (m, t, p) => `/css/${p.replace(/\.(scss|css)$/, '.min.css')}`,
    )
}

// * --- EXPORT GULP TASK FOR INLINE CRITICAL CSS TO HTML FILES
// * ----------------------------------------------------------
export async function criticalCss() {
    // * Пропускаем текущий таск при локальной сборке или если включен полный инлайн CSS
    if (env.isInlineCSS) {
        notify.info(
            NOTIFICATION_HANDLER_TITLES.CRITICAL_CSS,
            'Skipped – full inline CSS is enabled.',
        )
        return
    }
    if (env.isLocal) {
        notify.info(NOTIFICATION_HANDLER_TITLES.CRITICAL_CSS, 'Skipped – local (file:///) build.')
        return
    }

    // ! поиск всех html файлов
    const dir = nodePath.resolve(build.html)
    const htmlFiles = fastGlob.sync('**/*.html', { cwd: dir, absolute: true })
    if (!htmlFiles.length) {
        notify.warn(
            NOTIFICATION_HANDLER_TITLES.CRITICAL_CSS,
            'No HTML files found in build directory!',
        )
        return
    }

    if (env.isVerbose) {
        const cssFiles = fastGlob.sync('**/*.css', { cwd: build.styles, absolute: true })
        const combinedCss = cssFiles.map((file) => fs.readFileSync(file, 'utf-8')).join('\n')

        console.log('════════════ CRITICAL-CSS (BEASTIES) DEBUG ════════════')
        console.log('build.html        :', build.html)
        console.log('htmlFiles length  :', htmlFiles.length)
        console.log('cssFiles length   :', cssFiles.length)
        console.log('combinedCss.size  :', combinedCss.length, 'chars')
        console.log('══════════════════════════════════════════════════════')
    }

    // ! кастомный логгер для Beasties
    const beastiesLogger = {
        // * Только для verbose режима
        trace: (msg) => env.isVerbose && console.log(`[Beasties TRACE] ${msg}`),
        debug: (msg) => env.isVerbose && console.log(`[Beasties DEBUG] ${msg}`),
        info: (msg) => env.isVerbose && notify.info(NOTIFICATION_HANDLER_TITLES.CRITICAL_CSS, msg),
        // * Предупреждения и ошибки выводим всегда
        warn: (msg) => notify.warn(NOTIFICATION_HANDLER_TITLES.CRITICAL_CSS, msg),
        error: (msg) => notify.warn(NOTIFICATION_HANDLER_TITLES.CRITICAL_CSS, msg), // Если есть notify.error, используй его
    }

    const beasties = new Beasties({
        // ! брать CSS и <link> тегов
        external: true,
        // ! базовая папка для поиска CSS файлов | относительно чего ищем
        path: nodePath.resolve(build.html),
        // ! Preload-статрегия для стилей
        preload: 'swap',
        // ! Fallback preload-стратегии загрузки стилей на NoJS системах
        noscriptFallback: true,
        // ! Обрабатываем инлайн стили <style> и вырезаем то, что не используется на странице
        reduceInlineStyles: true,
        // ! Сливаем все <style> в один на странице
        mergeStylesheets: true,
        // ! Шрифты: inline + preload | <html> обязательно должен содержать в себе font-family заданный явно
        fonts: true,
        // ! Кейфреймы — только те, что нужны critical css
        keyframes: 'critical',
        // ! Сжатие critical css
        compress: true,
        // ! Аналог penthouse forceInclude из старой таски
        allowRules: [
            /:root/,
            /data-theme/,
            /^\*/,
            /^\.js/,
            /^\.nojs/,
            /^\.page-/,
            /^\.avif/,
            /^\.webp/,
            /^\.rounded-/,
        ],
        // ! Назначем logger
        logger: beastiesLogger,
        // ! Меняем logLevel в зависимости от --verbose флага
        logLevel: env.isVerbose ? 'trace' : 'warn',
    })

    for (const filePath of htmlFiles) {
        const originalHtml = fs.readFileSync(filePath, 'utf-8')

        // ! 1. Подменяем алиасы ТОЛЬКО В ПАМЯТИ, чтобы Beasties нашел файлы
        const resolvedHtml = resolveAliasesForCritical(originalHtml)

        try {
            // ! 2. Beasties сам вырежет критический CSS и вставит его в <style>
            const processed = await beasties.process(resolvedHtml)

            // ! 3. Если это Django-сборка, возвращаем CSS-плейсхолдеры обратно,
            // ! чтобы djangoizeHtml (которая запустится после) смогла их заменить на {% static %}
            let finalHtml = processed
            if (env.isDjangoBuild) {
                if (env.cssMode === 'scss') {
                    finalHtml = finalHtml.replace(
                        /\/css\/([^"'\s)]+)\.min\.css/g,
                        (m, p) => `@scss/${p}.scss`,
                    )
                } else {
                    finalHtml = finalHtml.replace(
                        /\/css\/([^"'\s)]+)\.min\.css/g,
                        (m, p) => `@css/${p}.css`,
                    )
                }
            }

            // ! 4. Просто пишем результат на диск. Всё, что сгенерил Beasties, уже внутри.
            fs.writeFileSync(filePath, finalHtml)
        } catch (err) {
            notify.warn(
                NOTIFICATION_HANDLER_TITLES.CRITICAL_CSS,
                `${nodePath.basename(filePath)}: ${err.message}`,
            )
        }
    }

    // * update dev server
    browserSync.reload()
}

// * --- REGISTER GULP TASK
// * ----------------------
gulp.task('critical-css', criticalCss)
